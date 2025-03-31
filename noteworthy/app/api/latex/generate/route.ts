import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { promises as fsPromises } from "fs";
import os from "os";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const uploadDir = path.join(os.tmpdir(), "uploads", "temp");

  try {
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
    console.log("Process type:", processType);

    const { run: runGemini } = await import("./geminiIntegration2");
    const latexCode: string = await runGemini(filePaths, processType);

    let cleanedLatex = latexCode.trim();

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

    await cleanUpFiles(uploadDir);

    return NextResponse.json({ cleanedLatex }); 

  } catch (error) {
    console.error("Error processing request:", error);

    await cleanUpFiles(uploadDir);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

async function cleanUpFiles(dir: string) {
  try {
    const files = await fsPromises.readdir(dir);
    await Promise.all(files.map(file => fsPromises.unlink(path.join(dir, file))));
  } catch (error) {
    console.error("Cleanup failed:", error);
  }
}