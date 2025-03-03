import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    // Parse JSON input
    const { latexCode } = await request.json();

    console.log("Received LaTeX code:", latexCode);
    
    // Validate input

    // Compile LaTeX
    const cloudRunUrl = "https://latex-service-7822565772.us-central1.run.app/compile";
    const response = await fetch(cloudRunUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ latex: latexCode }),
    });

    // Handle compilation errors
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`LaTeX compilation failed (${response.status}):`, errorText);
      return NextResponse.json(
        { 
          error: "LaTeX compilation failed",
          details: errorText 
        },
        { status: 422 }  // 422 Unprocessable Entity
      );
    }

    // Return PDF response
    const pdfBuffer = Buffer.from(await response.arrayBuffer());
    
    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "inline; filename=generated.pdf",
      },
    });
    
  } catch (error) {
    console.error("PDF generation error:", error);
    
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}