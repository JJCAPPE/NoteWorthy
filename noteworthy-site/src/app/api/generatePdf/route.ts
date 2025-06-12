import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    // Parse JSON input
    const { latexCode } = await request.json();

    // Build full LaTeX document by injecting the user-generated code
    const templatePath = `${process.cwd()}/src/app/api/generatePdf/templates/main.txt`;
    const template = await (
      await import("fs/promises")
    ).readFile(templatePath, "utf8");

    // --- Sanitize Gemini output -----------------------------------------
    const extractBody = (src: string): string => {
      let cleaned = src.trim();

      // strip ``` fences (```latex or ```)
      cleaned = cleaned
        .replace(/^```(?:latex)?/i, "")
        .replace(/```$/i, "")
        .trim();

      const beginIdx = cleaned.indexOf("\\begin{document}");
      if (beginIdx !== -1) {
        const afterBegin = beginIdx + "\\begin{document}".length;
        const endIdx = cleaned.indexOf("\\end{document}", afterBegin);
        const body =
          endIdx !== -1
            ? cleaned.slice(afterBegin, endIdx)
            : cleaned.slice(afterBegin);
        return body.trim();
      }

      // if no explicit document env, drop any \documentclass line and return rest
      cleaned = cleaned.replace(/\\documentclass[^\n]*\n?/gi, "");
      return cleaned.trim();
    };

    const sanitizedBody = extractBody(latexCode);

    // Replace the <content> placeholder with the sanitized LaTeX body
    const fullLatex = template.replace("<content>", sanitizedBody);

    console.log("fullLatex", fullLatex);

    // Compile the document using texlive.net (supports POST, so no URL size limit)
    const formData = new FormData();
    formData.append("engine", "xelatex"); // you can change to xelatex if needed
    formData.append("return", "pdf"); // ask the service to return raw PDF
    formData.append("filename[]", "document.tex");
    formData.append("filecontents[]", fullLatex);

    const response = await fetch("https://texlive.net/cgi-bin/latexcgi", {
      method: "POST",
      body: formData,
    });

    // Handle compilation errors
    if (
      !response.ok ||
      response.headers.get("content-type") !== "application/pdf"
    ) {
      const errorText = await response.text();
      return NextResponse.json(
        {
          error: "LATEX_TO_PDF_COMPILATION_ERROR",
          details: errorText,
        },
        { status: 422 },
      );
    }

    // Return the compiled PDF directly to the client
    const pdfBuffer = Buffer.from(await response.arrayBuffer());

    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "inline; filename=generated.pdf",
      },
    });
  } catch (error) {
    console.error("LATEX_TO_PDF_COMPILATION_ERROR", error);

    return NextResponse.json(
      {
        error: "LATEX_TO_PDF_COMPILATION_ERROR",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
