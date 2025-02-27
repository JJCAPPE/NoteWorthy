import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";

export async function POST(request: Request) {
  try {
    const { latexCode } = await request.json();

    console.log("Received LaTeX code:", latexCode);

    if (typeof latexCode !== "string") {
      return NextResponse.json(
        { error: "Invalid latexCode" },
        { status: 400 }
      );
    }

    const templatePath = path.join(
      process.cwd(),
      "app",
      "api",
      "latex",
      "compose",
      "templates",
      "main.txt"
    );

    const template = fs.readFileSync(templatePath, "utf8");
    const finalLatex = template.replace("<content>", latexCode.trim());

    return NextResponse.json({ finalLatex }, { status: 200 });
  } catch (error) {
    console.error("Error in POST /api/latex/compose:", error);
    return NextResponse.json(
      { error: "Failed to read template" },
      { status: 500 }
    );
  }
}