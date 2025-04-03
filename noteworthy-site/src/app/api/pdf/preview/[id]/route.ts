import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/utils/auth";
import { prisma } from "@/utils/prismaDB";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check if user is authenticated
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // User ID should be available because of our session callback in auth.ts
    const userId = session.user.id;
    if (!userId) {
      return NextResponse.json(
        { error: "User ID not found" },
        { status: 401 }
      );
    }

    const pdfId = params.id;

    // Find the PDF in the database
    const pdf = await prisma.savedPdf.findUnique({
      where: {
        id: pdfId,
        userId: userId as string, // Ensure the PDF belongs to the user
      },
    });

    if (!pdf) {
      return NextResponse.json(
        { error: "PDF not found" },
        { status: 404 }
      );
    }

    // Return the PDF content for preview (no attachment)
    const response = new NextResponse(pdf.content);
    response.headers.set("Content-Type", "application/pdf");
    // Don't set Content-Disposition to allow viewing in browser
    
    return response;
  } catch (error) {
    console.error("Error retrieving PDF:", error);
    return NextResponse.json(
      { error: "Failed to retrieve PDF" },
      { status: 500 }
    );
  }
}
