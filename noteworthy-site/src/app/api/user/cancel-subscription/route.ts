import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getServerSession } from "next-auth";
import { authOptions } from "@/utils/auth";
import { prisma } from "@/utils/prismaDB";

export async function POST(request: NextRequest) {
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
    
    console.log(`Cancelling subscription for user ${userId}`);
    
    // Initialize Stripe
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2025-03-31.basil" as any,
    });
    
    // Find user
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        stripeCustomerId: true,
        subscriptionId: true,
        subscriptionStatus: true
      }
    });
    
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    
    // If no subscription ID, nothing to cancel
    if (!user.subscriptionId) {
      return NextResponse.json({
        message: "No active subscription found"
      });
    }
    
    console.log(`Found subscription ID: ${user.subscriptionId}`);
    
    // Cancel the subscription at period end to avoid immediate cancellation
    const canceledSubscription = await stripe.subscriptions.update(
      user.subscriptionId,
      { cancel_at_period_end: true }
    );
    
    console.log(`Subscription will be canceled at period end: ${canceledSubscription.cancel_at_period_end}`);
    
    // Update user with canceled status in case webhook is slow or fails
    await prisma.user.update({
      where: { id: userId },
      data: {
        subscriptionStatus: "canceled"
      }
    });
    
    // Format the period end date - ensure timestamp is treated as seconds (Stripe uses seconds not milliseconds)
    let periodEndDate;
    try {
      // Multiply by 1000 to convert from seconds to milliseconds for JavaScript Date
      periodEndDate = new Date(canceledSubscription.current_period_end * 1000).toISOString();
    } catch (error) {
      console.error('Error formatting period end date:', error);
      periodEndDate = 'End of billing period';
    }

    return NextResponse.json({
      message: "Subscription will be canceled at the end of the billing period",
      subscription: {
        id: canceledSubscription.id,
        status: canceledSubscription.status,
        cancelAtPeriodEnd: canceledSubscription.cancel_at_period_end,
        currentPeriodEnd: periodEndDate
      }
    });
  } catch (error) {
    console.error('Error cancelling subscription:', error);
    return NextResponse.json({ error: "Failed to cancel subscription" }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic'; // Don't cache this route
