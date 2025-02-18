import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { promises as fsPromises } from "fs";
import { IncomingForm } from "formidable";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const uploadDir = path.join(process.cwd(), "uploads", "temp");
  
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

    // Clean LaTeX code (same as before)
    let cleanedLatex = latexCode.trim();
    // ... (rest of your cleaning logic)

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

    const { compileLatex } = await import("./latexCompiler");
    const outputDir = path.join(process.cwd(), "uploads", "latexuploads");
    await fsPromises.mkdir(outputDir, { recursive: true });

    const pdfBuffer: Buffer = await new Promise((resolve, reject) => {
      compileLatex(finalLatex, outputDir, (err: any, pdfPath: string) => {
        if (err) return reject(err);
        fsPromises.readFile(pdfPath).then(resolve).catch(reject);
      });
    });

    // Cleanup temporary files
    await Promise.all(filePaths.map(filePath => fsPromises.unlink(filePath)));

    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "attachment; filename=output.pdf",
      },
    });
  } catch (error) {
    console.error("Error processing request:", error);
    // Cleanup files on error
    const files = await fsPromises.readdir(uploadDir);
    await Promise.all(files.map(file =>
      fsPromises.unlink(path.join(uploadDir, file))
    ));
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}