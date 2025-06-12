import { Server as SocketIOServer } from "socket.io";
import { Server as HTTPServer } from "http";
import { promises as fsPromises } from "fs";
import path from "path";
import os from "os";

// Define message types for type safety
export interface LatexGenerationRequest {
  files: {
    name: string;
    buffer: ArrayBuffer;
    mimeType: string;
  }[];
  processType: string;
  modelType: string;
  customPrompt: string;
}

export interface LatexGenerationStatus {
  status:
    | "thinking"
    | "processing"
    | "processing_pdf"
    | "complete"
    | "compiling"
    | "error";
  content?: string;
  error?: string;
  progress?: number;
}

// Define the callback type to match geminiIntegration.js
type StreamCallback = (chunk: string, progress: number) => void;

// Import the run function with dynamic import to avoid TypeScript errors
let runFunction: any;

// We'll dynamically import it to avoid TypeScript errors
const importRun = async () => {
  console.log("[websocket.ts] Importing run function dynamically");
  try {
    // Using require to import CommonJS module
    const geminiIntegration = require("../app/api/latex/generate/geminiIntegration");
    runFunction = geminiIntegration.run;
    console.log(
      "[websocket.ts] Run function imported successfully:",
      !!runFunction,
    );
  } catch (error) {
    console.error("[websocket.ts] Failed to import run function:", error);
  }
};

// Make sure to import it before using
importRun();

let io: SocketIOServer | null = null;

/**
 * Initialize the WebSocket server
 */
export function initWebSocketServer(server: HTTPServer): SocketIOServer {
  if (io) return io;

  console.log("[websocket.ts] Initializing WebSocket server");

  io = new SocketIOServer(server, {
    cors: {
      origin:
        process.env.NODE_ENV === "production"
          ? ["https://noteworthy-site.vercel.app"]
          : ["http://localhost:3000"],
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    console.log("[websocket.ts] Client connected:", socket.id);

    // Handle LaTeX generation request
    socket.on("startLatexGeneration", async (data: LatexGenerationRequest) => {
      console.log("[websocket.ts] Received startLatexGeneration event:", {
        socketId: socket.id,
        fileCount: data.files.length,
        processType: data.processType,
        modelType: data.modelType,
      });

      try {
        // Make sure we have the run function
        if (!runFunction) {
          console.log("[websocket.ts] Run function not loaded, importing now");
          await importRun();
          if (!runFunction) {
            const error = "Failed to load the LaTeX generation function";
            console.error("[websocket.ts]", error);
            throw new Error(error);
          }
        }

        // Notify client we're thinking
        socket.emit("latexGenerationStatus", {
          status: "thinking",
          content: "Preparing to process your notes...",
        } as LatexGenerationStatus);
        console.log("[websocket.ts] Sent thinking status to client");

        // Create temporary directory for files
        const uploadDir = path.join(os.tmpdir(), "uploads", "temp");
        await fsPromises.mkdir(uploadDir, { recursive: true });
        console.log("[websocket.ts] Created temp directory:", uploadDir);

        // Save files to temporary directory
        const filePaths: string[] = [];
        for (const file of data.files) {
          const fileName = `${Date.now()}-${file.name}`;
          const filePath = path.join(uploadDir, fileName);
          await fsPromises.writeFile(filePath, new Uint8Array(file.buffer));
          filePaths.push(filePath);
        }
        console.log("[websocket.ts] Saved files to disk:", {
          count: filePaths.length,
        });

        // Notify client we're starting processing
        socket.emit("latexGenerationStatus", {
          status: "processing",
          content: "Starting the AI model...",
          progress: 5,
        } as LatexGenerationStatus);
        console.log("[websocket.ts] Starting Gemini model with streaming");

        // Start the Gemini model with streaming
        const streamResult = await runFunction(
          filePaths,
          data.processType,
          data.modelType,
          data.customPrompt,
          // Add callback function to stream results
          (chunk: string, progress: number) => {
            socket.emit("latexGenerationStatus", {
              status: "processing",
              content: chunk,
              progress,
            } as LatexGenerationStatus);
          },
        );

        console.log(
          "[websocket.ts] Gemini processing complete, result:",
          streamResult.isErr() ? "ERROR" : "SUCCESS",
        );

        if (streamResult.isErr()) {
          const { type, error } = streamResult.error;
          console.error("[websocket.ts] Gemini error:", { type, error });
          socket.emit("latexGenerationStatus", {
            status: "error",
            error: `${type}: ${error}`,
          } as LatexGenerationStatus);
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
          const files = await fsPromises.readdir(uploadDir);
          await Promise.all(
            files.map((file) => fsPromises.unlink(path.join(uploadDir, file))),
          );
        } catch (e) {
          console.error("Failed to clean up files:", e);
        }

        // Send final result
        socket.emit("latexGenerationStatus", {
          status: "complete",
          content: cleanedLatex,
          progress: 100,
        } as LatexGenerationStatus);
      } catch (error) {
        console.error("Error in LaTeX generation:", error);
        socket.emit("latexGenerationStatus", {
          status: "error",
          error: error instanceof Error ? error.message : "Unknown error",
        } as LatexGenerationStatus);
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
export function getIO(): SocketIOServer {
  if (!io) {
    throw new Error("WebSocket server not initialized");
  }
  return io;
}
