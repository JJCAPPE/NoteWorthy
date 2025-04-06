import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/utils/auth";
import { prisma } from "@/utils/prismaDB";

export async function GET(request: NextRequest) {
  try {
    // Get authentication session
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "User not authenticated" }, { status: 401 });
    }
    
    // Handle the session.user.id carefully as noted in memory
    const userId = session.user.id as string;
    if (!userId) {
      console.error('Session user ID is missing from the session object');
      return NextResponse.json({ error: "User ID not found" }, { status: 400 });
    }
    
    // Try to find the user and their subscription information
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        subscriptionStatus: true,
        subscriptionPlan: true,
        subscriptionId: true
      }
    });
    
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    
    return NextResponse.json(user);
  } catch (error) {
    console.error('Error fetching user subscription:', error);
    return NextResponse.json({ error: "Failed to fetch subscription data" }, { status: 500 });
  }
}
