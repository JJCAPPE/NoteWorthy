import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { promises as fsPromises } from "fs";
import os from "os";
import { ok, err, Result } from "neverthrow";
import { run } from  "./geminiIntegration"

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const uploadDir = path.join(os.tmpdir(), "uploads", "temp");

  // Ensure upload directory exists
  await fsPromises.mkdir(uploadDir, { recursive: true });

  // Parse form data using Web API
  const formData = await request.formData();
  const noteImages = formData.getAll("noteImage") as File[];

  // Save files to temporary directory
  const filePaths: string[] = [];
  for (const file of noteImages) {
    const buffer = await file.arrayBuffer();
    const fileName = `${Date.now()}-${file.name}`;
    const filePath = path.join(uploadDir, fileName);
    await fsPromises.writeFile(filePath, new Uint8Array(buffer));
    filePaths.push(filePath);
  }

  const processType = formData.get("processType")?.toString() || "base";
  const customPrompt = formData.get("customPrompt")?.toString() || "";

  console.log("Process type:", processType);
  console.log("Custom Prompt:", customPrompt);

  const latexCode = await run(filePaths, processType, customPrompt);

  if (latexCode.isErr()) {
    const { type, error } = latexCode.error;
    const cleanupResult = await cleanUpFiles(uploadDir);
    if (cleanupResult.isErr()) {
      console.error("CLEANUP_FAILED: ", cleanupResult.error);
    }
    return NextResponse.json(
      {
        type: type,
        error: error,
      },
      { status: 500 },
    );
  }

  let cleanedLatex = latexCode.value.output.trim();

  if (cleanedLatex.startsWith("```latex")) {
    cleanedLatex = cleanedLatex.substring("```latex".length).trim();
  }
  if (cleanedLatex.endsWith("```")) {
    cleanedLatex = cleanedLatex.substring(0, cleanedLatex.length - 3).trim();
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

  const cleanupResult = await cleanUpFiles(uploadDir);
  if (cleanupResult.isErr()) {
    console.error("CLEANUP_FAILED: ", cleanupResult.error);
  }

  return NextResponse.json({ cleanedLatex });
}

async function cleanUpFiles(dir: string): Promise<Result<void, unknown>> {
  try {
    const files = await fsPromises.readdir(dir);
    await Promise.all(
      files.map((file) => fsPromises.unlink(path.join(dir, file))),
    );
    return ok(undefined);
  } catch (e) {
    return err(e);
  }
}
