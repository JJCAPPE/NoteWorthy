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

    const { run: runGemini } = await import("./geminiIntegration");
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

    const templatePath = path.join(
      process.cwd(),
      "app",
      "api",
      "upload",
      "templates",
      "main.txt"
    );
    const template = await fsPromises.readFile(templatePath, "utf8");
    const finalLatex = template.replace("<content>", cleanedLatex);

    const jsonFriendly = JSON.stringify({ latex: finalLatex });

    // Call the Cloud Run endpoint for LaTeX compilation
    const cloudRunUrl =
      "https://latex-service-7822565772.us-central1.run.app/compile";
    const response = await fetch(cloudRunUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: jsonFriendly,
    });

    // Enhanced error handling: Try to read error details if response is not OK.
    if (!response.ok) {
      let errorDetails = "";
      try {
        errorDetails = await response.text();
      } catch (e) {
        errorDetails = `Unable to parse error details.`;
      }
      throw new Error(
        `LaTeX compilation failed with status ${response.status}: ${errorDetails}`
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    const pdfBuffer = Buffer.from(arrayBuffer);

    // Cleanup temporary files
    await Promise.all(filePaths.map((filePath) => fsPromises.unlink(filePath)));

    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "attachment; filename=output.pdf",
      },
    });
  } catch (error) {
    console.error("Error processing request:", error);

    // Cleanup files on error, if possible
    try {
      const files = await fsPromises.readdir(uploadDir);
      await Promise.all(
        files.map((file) => fsPromises.unlink(path.join(uploadDir, file)))
      );
    } catch (cleanupError) {
      console.error("Error cleaning up files:", cleanupError);
    }
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
