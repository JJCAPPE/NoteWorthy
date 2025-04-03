import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/utils/auth";
import { prisma } from "@/utils/prismaDB";
import { PDFDocument } from 'pdf-lib';

export async function POST(req: NextRequest) {
  try {
    // Check if user is authenticated
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    if (!userId) {
      return NextResponse.json(
        { error: "User ID not found" },
        { status: 401 }
      );
    }
    
    // Parse request body
    const { pdfIds, title } = await req.json();
    
    if (!pdfIds || !Array.isArray(pdfIds) || pdfIds.length === 0) {
      return NextResponse.json(
        { error: "No PDFs selected for combining" },
        { status: 400 }
      );
    }

    // Fetch all the PDFs from the database
    const pdfs = await prisma.savedPdf.findMany({
      where: {
        id: { in: pdfIds },
        userId: userId as string, // Ensure the PDFs belong to the user
      },
    });

    if (pdfs.length !== pdfIds.length) {
      return NextResponse.json(
        { error: "Some PDFs were not found" },
        { status: 404 }
      );
    }

    // Create a new PDF document
    const mergedPdf = await PDFDocument.create();
    
    // Add pages from each PDF
    for (const pdf of pdfs) {
      const pdfDoc = await PDFDocument.load(pdf.content);
      const copiedPages = await mergedPdf.copyPages(pdfDoc, pdfDoc.getPageIndices());
      copiedPages.forEach((page) => {
        mergedPdf.addPage(page);
      });
    }
    
    // Save the merged PDF
    const mergedPdfBytes = await mergedPdf.save();
    
    // If title is provided, save the combined PDF to the database
    if (title) {
      await prisma.savedPdf.create({
        data: {
          title,
          content: Buffer.from(mergedPdfBytes),
          userId: userId as string,
          processType: 'combined',
          sourceFiles: pdfs.map(pdf => `Combined from: ${pdf.title}`),
          prompt: 'Combined PDF',
        },
      });
    }

    // Return the merged PDF
    const response = new NextResponse(mergedPdfBytes);
    response.headers.set("Content-Type", "application/pdf");
    
    // Only set Content-Disposition header if the user requested to download it
    // This allows the PDF to be previewed in the browser instead of being downloaded automatically
    const downloadParam = req.nextUrl.searchParams.get('download');
    if (downloadParam === 'true') {
      response.headers.set(
        "Content-Disposition", 
        `attachment; filename="${encodeURIComponent(title || 'combined')}.pdf"`
      );
    }
    
    return response;
  } catch (error) {
    console.error("Error combining PDFs:", error);
    return NextResponse.json(
      { error: "Failed to combine PDFs" },
      { status: 500 }
    );
  }
}
