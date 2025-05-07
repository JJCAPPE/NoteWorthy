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

    io = new SocketIOServer(server, {
        cors: {
            origin: process.env.NODE_ENV === "production" ?
                ["https://noteworthy-site.vercel.app"] :
                ["http://localhost:3000"],
            methods: ["GET", "POST"],
            credentials: true,
        },
    });

    io.on("connection", (socket) => {
        console.log("Client connected:", socket.id);

        // Handle LaTeX generation request
        socket.on("startLatexGeneration", async(data) => {
            try {
                // Notify client we're thinking
                socket.emit("latexGenerationStatus", {
                    status: "thinking",
                    content: "Preparing to process your notes...",
                });

                // Create temporary directory for files
                const uploadDir = path.join(os.tmpdir(), "uploads", "temp");
                await fs.mkdir(uploadDir, { recursive: true });

                // Save files to temporary directory
                const filePaths = [];
                for (const file of data.files) {
                    const fileName = `${Date.now()}-${file.name}`;
                    const filePath = path.join(uploadDir, fileName);
                    await fs.writeFile(filePath, new Uint8Array(file.buffer));
                    filePaths.push(filePath);
                }

                // Notify client we're starting processing
                socket.emit("latexGenerationStatus", {
                    status: "processing",
                    content: "Starting the AI model...",
                    progress: 5,
                });

                // Start the Gemini model with streaming
                const streamResult = await run(
                    filePaths,
                    data.processType,
                    data.modelType,
                    data.customPrompt,
                    // Add callback function to stream results
                    (chunk, progress) => {
                        socket.emit("latexGenerationStatus", {
                            status: "processing",
                            content: chunk,
                            progress,
                        });
                    },
                );

                if (streamResult.isErr()) {
                    const { type, error } = streamResult.error;
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

                // Clean up files
                try {
                    const files = await fs.readdir(uploadDir);
                    await Promise.all(
                        files.map((file) => fs.unlink(path.join(uploadDir, file))),
                    );
                } catch (e) {
                    console.error("Failed to clean up files:", e);
                }

                // Send final result
                socket.emit("latexGenerationStatus", {
                    status: "complete",
                    content: cleanedLatex,
                    progress: 100,
                });
            } catch (error) {
                console.error("Error in LaTeX generation:", error);
                socket.emit("latexGenerationStatus", {
                    status: "error",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        });

        socket.on("disconnect", () => {
            console.log("Client disconnected:", socket.id);
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