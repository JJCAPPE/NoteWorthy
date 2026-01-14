import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { promises as fsPromises } from "fs";
import os from "os";
import { run } from "./geminiIntegration";

export const runtime = "nodejs";
export const dynamic = 'force-dynamic';

// This tells Next.js not to use the default body parser
// so we can handle the request body manually with no size limit
export const config = {
  api: {
    // Disable Next.js's default body parser
    bodyParser: false,
  },
}

const MAX_FILES = 10;
const MAX_TOTAL_BYTES = 25 * 1024 * 1024; // 25MB
const VALID_PROCESS_TYPES = new Set(["summary", "expansion", "base"]);
const VALID_MODEL_TYPES = new Set(["regular", "fast", "pro"]);

type FileEntry = {
  path: string;
  mimeType: string;
};

type RunFunction = (
  filePaths: FileEntry[] | string[],
  processType: string,
  modelType: string,
  customPrompt: string,
  streamCallback?: (chunk: string, progress: number) => void,
) => Promise<any>;

const runWithStream = run as unknown as RunFunction;

export async function POST(request: NextRequest) {
  const acceptHeader = request.headers.get("accept") || "";
  const wantsStream = acceptHeader.includes("text/event-stream");

  const uploadDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), "noteworthy-"));

  const cleanupFiles = async () => {
    try {
      await fsPromises.rm(uploadDir, { recursive: true, force: true });
    } catch (cleanupError) {
      console.error("CLEANUP_FAILED:", cleanupError);
    }
  };

  try {
    // Parse form data using Web API
    const formData = await request.formData();
    const noteImages = formData.getAll("noteImage") as File[];

    if (!noteImages || noteImages.length === 0) {
      return NextResponse.json(
        {
          type: "INVALID_INPUT",
          error: "No files provided.",
        },
        { status: 400 },
      );
    }

    if (noteImages.length > MAX_FILES) {
      return NextResponse.json(
        {
          type: "INVALID_INPUT",
          error: `Too many files. Max ${MAX_FILES} files allowed.`,
        },
        { status: 400 },
      );
    }

    const totalBytes = noteImages.reduce((sum, file) => sum + file.size, 0);
    if (totalBytes > MAX_TOTAL_BYTES) {
      return NextResponse.json(
        {
          type: "PAYLOAD_TOO_LARGE",
          error: `Files too large. Max ${Math.floor(
            MAX_TOTAL_BYTES / (1024 * 1024),
          )}MB total allowed.`,
        },
        { status: 413 },
      );
    }

    const processType = formData.get("processType")?.toString();
    const customPrompt = formData.get("customPrompt")?.toString() || "";
    const modelType = formData.get("modelType")?.toString();

    console.log("Process type:", processType);
    console.log("Custom Prompt:", customPrompt);
    console.log("Model Type:", modelType);

    if (!processType || !VALID_PROCESS_TYPES.has(processType)) {
      return NextResponse.json(
        {
          type: "INVALID_INPUT",
          error: "Process type is required.",
        },
        { status: 400 },
      );
    }
    if (!modelType || !VALID_MODEL_TYPES.has(modelType)) {
      return NextResponse.json(
        {
          type: "INVALID_INPUT",
          error: "Model type is required.",
        },
        { status: 400 },
      );
    }

    for (const file of noteImages) {
      if (!file.type || !file.type.startsWith("image/")) {
        return NextResponse.json(
          {
            type: "INVALID_INPUT",
            error: `Unsupported file type: ${file.type || "unknown"}.`,
          },
          { status: 400 },
        );
      }
    }

    // Save files to temporary directory
    const fileEntries: FileEntry[] = [];
    for (const file of noteImages) {
      const buffer = await file.arrayBuffer();
      const fileName = `${Date.now()}-${file.name}`;
      const filePath = path.join(uploadDir, fileName);
      await fsPromises.writeFile(filePath, new Uint8Array(buffer));
      fileEntries.push({
        path: filePath,
        mimeType: file.type || "image/jpeg",
      });
    }

    const cleanLatex = (rawLatex: string) => {
      let cleanedLatex = rawLatex.trim();

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

      return cleanedLatex;
    };

    if (!wantsStream) {
      const latexCode = await runWithStream(
        fileEntries,
        processType,
        modelType,
        customPrompt,
      );

      if (latexCode.isErr()) {
        const { type, error } = latexCode.error;
        await cleanupFiles();
        return NextResponse.json(
          {
            type: type,
            error: error,
          },
          { status: 500 },
        );
      }

      const cleanedLatex = cleanLatex(latexCode.value.output);
      await cleanupFiles();
      return NextResponse.json({ cleanedLatex });
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        const sendEvent = (payload: unknown) => {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(payload)}\n\n`),
          );
        };

        const sendError = (message: string) => {
          sendEvent({ status: "error", error: message });
        };

        (async () => {
          try {
            sendEvent({
              status: "thinking",
              content: "Preparing to process your notes...",
            });

            sendEvent({
              status: "processing",
              content: "Starting the AI model...",
              progress: 5,
            });

            const streamResult = await runWithStream(
              fileEntries,
              processType,
              modelType,
              customPrompt,
              (chunk: string, progress: number) => {
                sendEvent({
                  status: "processing",
                  content: chunk,
                  progress,
                });
              },
            );

            if (streamResult.isErr()) {
              const { type, error } = streamResult.error;
              sendError(`${type}: ${error}`);
              return;
            }

            const cleanedLatex = cleanLatex(streamResult.value.output);
            sendEvent({
              status: "complete",
              content: cleanedLatex,
              progress: 100,
            });
          } catch (error) {
            sendError(
              error instanceof Error ? error.message : "Unknown error",
            );
          } finally {
            await cleanupFiles();
            controller.close();
          }
        })();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Error in POST /api/latex/generate:", error);
    await cleanupFiles();
    return NextResponse.json(
      {
        type: "UNKNOWN_ERROR",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

