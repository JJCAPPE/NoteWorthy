import { Server as SocketIOServer } from "socket.io";
import { Server as HTTPServer } from "http";
import { run } from "@/app/api/latex/generate/geminiIntegration";
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
  status: "thinking" | "processing" | "complete" | "error";
  content?: string;
  error?: string;
  progress?: number;
}

// Define the callback type to match geminiIntegration.js
type StreamCallback = (chunk: string, progress: number) => void;

// Augment the module declaration for proper typing
declare module "@/app/api/latex/generate/geminiIntegration" {
  export function run(
    filePaths: string | string[],
    processType: string,
    modelType: string,
    customPrompt: string,
    streamCallback?: StreamCallback | null,
  ): Promise<any>;
}

let io: SocketIOServer | null = null;

/**
 * Initialize the WebSocket server
 */
export function initWebSocketServer(server: HTTPServer): SocketIOServer {
  if (io) return io;

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
    console.log("Client connected:", socket.id);

    // Handle LaTeX generation request
    socket.on("startLatexGeneration", async (data: LatexGenerationRequest) => {
      try {
        // Notify client we're thinking
        socket.emit("latexGenerationStatus", {
          status: "thinking",
          content: "Preparing to process your notes...",
        } as LatexGenerationStatus);

        // Create temporary directory for files
        const uploadDir = path.join(os.tmpdir(), "uploads", "temp");
        await fsPromises.mkdir(uploadDir, { recursive: true });

        // Save files to temporary directory
        const filePaths: string[] = [];
        for (const file of data.files) {
          const fileName = `${Date.now()}-${file.name}`;
          const filePath = path.join(uploadDir, fileName);
          await fsPromises.writeFile(filePath, new Uint8Array(file.buffer));
          filePaths.push(filePath);
        }

        // Notify client we're starting processing
        socket.emit("latexGenerationStatus", {
          status: "processing",
          content: "Starting the AI model...",
          progress: 5,
        } as LatexGenerationStatus);

        // Start the Gemini model with streaming
        const streamResult = await run(
          filePaths,
          data.processType,
          data.modelType,
          data.customPrompt,
          // Add callback function to stream results
          ((chunk: string, progress: number) => {
            socket.emit("latexGenerationStatus", {
              status: "processing",
              content: chunk,
              progress,
            } as LatexGenerationStatus);
          }) as StreamCallback,
        );

        if (streamResult.isErr()) {
          const { type, error } = streamResult.error;
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
