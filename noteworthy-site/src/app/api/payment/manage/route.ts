import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getServerSession } from "next-auth";
import { authOptions } from "@/utils/auth";
import { prisma } from "@/utils/prismaDB";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json({ error: "User not authenticated" }, { status: 401 });
    }
    
    const userId = session.user.id as string; // Use type assertion as per memory note
    if (!userId) {
      return NextResponse.json({ error: "User ID not found" }, { status: 400 });
    }
    
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2023-10-16",
    });
    
    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });
    
    if (!user || !user.stripeCustomerId) {
      return NextResponse.json({ error: "No subscription found" }, { status: 404 });
    }
    
    // Create a portal session
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${process.env.SITE_URL}/dashboard`,
    });
    
    return NextResponse.json(portalSession.url);
  } catch (error) {
    console.error('Error creating portal session:', error);
    return NextResponse.json({ error: 'Failed to create portal session' }, { status: 500 });
  }
}
