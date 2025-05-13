const { Server: SocketIOServer } = require("socket.io");
const { run } = require("../app/api/latex/generate/geminiIntegration");
const fs = require("fs").promises;
const path = require("path");
const os = require("os");

let io = null;

/**
 * Initialize the WebSocket server
 */
function initWebSocketServer(server) {
    if (io) return io;

    console.log("[websocket.js] Initializing WebSocket server");

    io = new SocketIOServer(server, {
        cors: {
            origin: process.env.NODE_ENV === "production" ?
                ["https://noteworthy-site.vercel.app"] :
                ["http://localhost:3000"],
            methods: ["GET", "POST"],
            credentials: true,
        },
        maxHttpBufferSize: 50 * 1024 * 1024, // 50MB buffer size for large file transfers
    });

    // Add global error handler for Socket.IO
    io.engine.on("connection_error", (err) => {
        console.error("[websocket.js] Connection error:", err);
    });

    io.on("connection", (socket) => {
        console.log("[websocket.js] Client connected:", socket.id);

        // Add error handler for this socket
        socket.on("error", (error) => {
            console.error(
                "[websocket.js] Socket error for client",
                socket.id,
                ":",
                error,
            );
        });

        // Handle LaTeX generation request
        socket.on("startLatexGeneration", async(data) => {
            console.log("[websocket.js] Received startLatexGeneration event:", {
                socketId: socket.id,
                fileCount: data.files ? data.files.length : 0,
                processType: data.processType,
                modelType: data.modelType,
            });

            if (!data ||
                !data.files ||
                !Array.isArray(data.files) ||
                data.files.length === 0
            ) {
                console.error("[websocket.js] Invalid data received:", data);
                socket.emit("latexGenerationStatus", {
                    status: "error",
                    error: "Invalid data: No files provided",
                });
                return;
            }

            try {
                // Validate input data
                if (!data.processType) {
                    throw new Error("Process type is required");
                }

                if (!data.modelType) {
                    throw new Error("Model type is required");
                }

                // Notify client we're thinking
                socket.emit("latexGenerationStatus", {
                    status: "thinking",
                    content: "Preparing to process your notes...",
                });
                console.log("[websocket.js] Sent thinking status to client");

                // Create temporary directory for files
                const uploadDir = path.join(os.tmpdir(), "uploads", "temp");
                await fs.mkdir(uploadDir, { recursive: true });
                console.log("[websocket.js] Created temp directory:", uploadDir);

                // Save files to temporary directory
                const filePaths = [];
                try {
                    for (const file of data.files) {
                        if (!file.buffer) {
                            throw new Error(`File buffer is missing for file ${file.name}`);
                        }

                        const fileName = `${Date.now()}-${file.name}`;
                        const filePath = path.join(uploadDir, fileName);
                        await fs.writeFile(filePath, new Uint8Array(file.buffer));
                        filePaths.push(filePath);
                        console.log(`[websocket.js] Saved file: ${fileName}`);
                    }
                    console.log("[websocket.js] Saved files to disk:", {
                        count: filePaths.length,
                    });
                } catch (fileError) {
                    console.error("[websocket.js] Error saving files:", fileError);
                    throw new Error(`Failed to save files: ${fileError.message}`);
                }

                if (filePaths.length === 0) {
                    throw new Error("No files were saved successfully");
                }

                // Notify client we're starting processing
                socket.emit("latexGenerationStatus", {
                    status: "processing",
                    content: "Starting the AI model...",
                    progress: 5,
                });
                console.log("[websocket.js] Starting Gemini model with streaming");

                // Start the Gemini model with streaming
                try {
                    const streamResult = await run(
                        filePaths,
                        data.processType,
                        data.modelType,
                        data.customPrompt || "",
                        // Add callback function to stream results
                        (chunk, progress) => {
                            try {
                                socket.emit("latexGenerationStatus", {
                                    status: "processing",
                                    content: chunk,
                                    progress,
                                });
                            } catch (callbackError) {
                                console.error(
                                    "[websocket.js] Error in streaming callback:",
                                    callbackError,
                                );
                            }
                        },
                    );

                    console.log(
                        "[websocket.js] Gemini processing complete, result:",
                        streamResult.isErr() ? "ERROR" : "SUCCESS",
                    );

                    if (streamResult.isErr()) {
                        const { type, error } = streamResult.error;
                        console.error("[websocket.js] Gemini error:", { type, error });
                        socket.emit("latexGenerationStatus", {
                            status: "error",
                            error: `${type}: ${error}`,
                        });
                        return;
                    }

                    // Process the final LaTeX code
                    let cleanedLatex = streamResult.value.output.trim();

                    if (cleanedLatex.startsWith("```latex")) {
                        cleanedLatex = cleanedLatex.substring("```latex".length).trim();
                    }
                    if (cleanedLatex.endsWith("```")) {
                        cleanedLatex = cleanedLatex
                            .substring(0, cleanedLatex.length - 3)
                            .trim();
                    }
                    // If the cleaned LaTeX contains a \begin{document}, remove it and everything before
                    const documentStart = "\\begin{document}";
                    const docIndex = cleanedLatex.indexOf(documentStart);
                    if (docIndex !== -1) {
                        cleanedLatex = cleanedLatex
                            .substring(docIndex + documentStart.length)
                            .trim();
                    }
                    // Remove any instances of ", tdplot_main_coords"
                    cleanedLatex = cleanedLatex.replace(/, tdplot_main_coords/g, "");

                    // Send final result
                    socket.emit("latexGenerationStatus", {
                        status: "complete",
                        content: cleanedLatex,
                        progress: 100,
                    });
                    console.log(
                        "[websocket.js] Sent complete status to client with LaTeX content",
                    );
                } catch (geminiError) {
                    console.error(
                        "[websocket.js] Error in Gemini processing:",
                        geminiError,
                    );
                    throw new Error(`Gemini processing failed: ${geminiError.message}`);
                } finally {
                    // Clean up files - do this in finally to ensure cleanup happens even if there was an error
                    try {
                        const files = await fs.readdir(uploadDir);
                        await Promise.all(
                            files.map((file) => fs.unlink(path.join(uploadDir, file))),
                        );
                        console.log("[websocket.js] Cleaned up files in temp directory");
                    } catch (cleanupError) {
                        console.error(
                            "[websocket.js] Failed to clean up files:",
                            cleanupError,
                        );
                    }
                }
            } catch (error) {
                console.error(
                    "[websocket.js] Error in LaTeX generation:",
                    error.message,
                );
                console.error("[websocket.js] Full error:", error);
                // Send detailed error to client
                try {
                    socket.emit("latexGenerationStatus", {
                        status: "error",
                        error: error instanceof Error ? error.message : "Unknown error",
                    });
                    console.log("[websocket.js] Sent error status to client");
                } catch (socketError) {
                    console.error(
                        "[websocket.js] Failed to send error to client:",
                        socketError,
                    );
                }
            }
        });

        socket.on("disconnect", () => {
            console.log("[websocket.js] Client disconnected:", socket.id);
        });
    });

    return io;
}

/**
 * Get the WebSocket server instance
 */
function getIO() {
    if (!io) {
        throw new Error("WebSocket server not initialized");
    }
    return io;
}

module.exports = { initWebSocketServer, getIO };