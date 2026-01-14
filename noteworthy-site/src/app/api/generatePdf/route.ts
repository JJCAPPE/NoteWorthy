import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const DEFAULT_COMPILER_URL =
  "https://latex-service-7822565772.us-central1.run.app/compile";
const COMPILER_TIMEOUT_MS = 30000;
const RETRY_DELAYS_MS = [400, 1200];

type CompileAttempt = {
  contentType: string;
  body: string;
  label: string;
};

const getCompilerUrls = () => {
  const envUrls = process.env.LATEX_COMPILER_URLS;
  if (envUrls) {
    return envUrls
      .split(",")
      .map((url) => url.trim())
      .filter(Boolean);
  }

  const singleUrl = process.env.LATEX_COMPILER_URL;
  if (singleUrl) {
    return [singleUrl.trim()];
  }

  return [DEFAULT_COMPILER_URL];
};

const isPdfBuffer = (buffer: Uint8Array) =>
  buffer.length >= 4 &&
  buffer[0] === 0x25 && // %
  buffer[1] === 0x50 && // P
  buffer[2] === 0x44 && // D
  buffer[3] === 0x46; // F

const fetchWithTimeout = async (url: string, init: RequestInit) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), COMPILER_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const compileWithTarget = async (
  url: string,
  latexCode: string,
): Promise<Buffer | { errors: string[] }> => {
  const attempts: CompileAttempt[] = [
    {
      contentType: "application/json",
      body: JSON.stringify({ latex: latexCode }),
      label: "json-latex",
    },
    {
      contentType: "application/json",
      body: JSON.stringify({ latexCode }),
      label: "json-latexCode",
    },
    {
      contentType: "text/plain",
      body: latexCode,
      label: "text-plain",
    },
  ];

  const errors: string[] = [];

  for (const attempt of attempts) {
    for (let retry = 0; retry <= RETRY_DELAYS_MS.length; retry += 1) {
      try {
        const response = await fetchWithTimeout(url, {
          method: "POST",
          headers: { "Content-Type": attempt.contentType },
          body: attempt.body,
        });

        if (!response.ok) {
          const errorText = await response.text();
          errors.push(
            `${attempt.label} (${response.status}): ${errorText.slice(0, 500)}`,
          );
        } else {
          const arrayBuffer = await response.arrayBuffer();
          const pdfBytes = new Uint8Array(arrayBuffer);

          if (!isPdfBuffer(pdfBytes)) {
            const errorText = await response.text().catch(() => "");
            errors.push(
              `${attempt.label} (invalid-pdf): ${errorText.slice(0, 500)}`,
            );
          } else {
            return Buffer.from(pdfBytes);
          }
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        errors.push(`${attempt.label} (network): ${message}`);
      }

      if (retry < RETRY_DELAYS_MS.length) {
        await sleep(RETRY_DELAYS_MS[retry]);
      }
    }
  }

  return { errors };
};

export async function POST(request: NextRequest) {
  try {
    // Parse JSON input
    const { latexCode } = await request.json();
    if (typeof latexCode !== "string" || !latexCode.trim()) {
      return NextResponse.json(
        {
          error: "LATEX_TO_PDF_COMPILATION_ERROR",
          details: "Invalid latexCode payload",
        },
        { status: 400 },
      );
    }

    const compilerUrls = getCompilerUrls();
    const failures: Record<string, string[]> = {};

    for (const compilerUrl of compilerUrls) {
      const result = await compileWithTarget(compilerUrl, latexCode);
      if (Buffer.isBuffer(result)) {
        return new NextResponse(new Uint8Array(result), {
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": "inline; filename=generated.pdf",
          },
        });
      }

      failures[compilerUrl] = result.errors;
    }

    return NextResponse.json(
      {
        error: "LATEX_TO_PDF_COMPILATION_ERROR",
        details: "All compilation backends failed",
        backends: failures,
      },
      { status: 502 },
    );
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