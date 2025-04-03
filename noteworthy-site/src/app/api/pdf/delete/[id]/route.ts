import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/utils/auth";
import { prisma } from "@/utils/prismaDB";

export async function DELETE(
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

    // Find the PDF to ensure it belongs to the user
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

    // Delete the PDF
    await prisma.savedPdf.delete({
      where: {
        id: pdfId,
      },
    });

    return NextResponse.json(
      { message: "PDF deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting PDF:", error);
    return NextResponse.json(
      { error: "Failed to delete PDF" },
      { status: 500 }
    );
  }
}
