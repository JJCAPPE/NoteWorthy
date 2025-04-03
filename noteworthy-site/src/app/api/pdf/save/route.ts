import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/utils/auth";
import { prisma } from "@/utils/prismaDB";

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

    // Get user ID from session
    const userId = session.user.id;
    if (!userId) {
      return NextResponse.json(
        { error: "User ID not found" },
        { status: 401 }
      );
    }
    
    // Parse request body
    const formData = await req.formData();
    const title = formData.get('title') as string;
    const pdfBlob = formData.get('pdf') as Blob;
    const processType = formData.get('processType') as string;
    const sourceFiles = JSON.parse(formData.get('sourceFiles') as string);
    const prompt = formData.get('prompt') as string || '';
    
    if (!title || !pdfBlob) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Convert PDF blob to buffer for database storage
    const pdfBuffer = Buffer.from(await pdfBlob.arrayBuffer());

    // Save PDF to database
    const savedPdf = await prisma.savedPdf.create({
      data: {
        title,
        content: pdfBuffer,
        userId,
        processType,
        sourceFiles,
        prompt,
      },
    });

    return NextResponse.json(
      { 
        message: "PDF saved successfully", 
        id: savedPdf.id 
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error saving PDF:", error);
    return NextResponse.json(
      { error: "Failed to save PDF" },
      { status: 500 }
    );
  }
}
