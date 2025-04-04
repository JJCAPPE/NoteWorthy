import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/utils/auth";
import { prisma } from "@/utils/prismaDB";

export async function GET(req: NextRequest) {
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

    // Get all PDFs for the user
    const pdfs = await prisma.savedPdf.findMany({
      where: {
        userId: userId as string,
      },
      select: {
        id: true,
        title: true,
        createdAt: true,
        processType: true,
        // Don't include the content (PDF binary data) in the list response
      },
      orderBy: {
        createdAt: 'desc', // Most recent first
      },
    });

    return NextResponse.json(pdfs);
  } catch (error) {
    console.error("Error listing PDFs:", error);
    return NextResponse.json(
      { error: "Failed to list PDFs" },
      { status: 500 }
    );
  }
}
