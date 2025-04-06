import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
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
    
    console.log(`Refreshing subscription for user ${userId}`);
    
    // Initialize Stripe
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2025-03-31.basil" as any,
    });
    
    // Find user
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });
    
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    
    // Check if user has a lifetime subscription first
    if (user.subscriptionPlan === 'Lifetime Premium' && 
        user.subscriptionStatus === 'active' && 
        user.subscriptionId?.startsWith('lifetime_')) {
      
      console.log('User has a lifetime subscription, no need to check Stripe');
      return NextResponse.json({
        subscriptionStatus: user.subscriptionStatus,
        subscriptionPlan: user.subscriptionPlan,
        subscriptionId: user.subscriptionId
      });
    }
    
    // If no customer ID, no subscription to check
    if (!user.stripeCustomerId) {
      return NextResponse.json({
        subscriptionStatus: "inactive",
        subscriptionPlan: "free"
      });
    }
    
    console.log(`Found Stripe customer ID: ${user.stripeCustomerId}`);
    
    // Get subscriptions for this customer
    const subscriptions = await stripe.subscriptions.list({
      customer: user.stripeCustomerId,
      status: 'all',
      limit: 1,
    });
    
    console.log(`Found ${subscriptions.data.length} subscriptions`);
    
    if (subscriptions.data.length === 0) {
      console.log('No subscription found');
      // No subscription found
      await prisma.user.update({
        where: { id: userId },
        data: {
          subscriptionStatus: "inactive",
          subscriptionPlan: "free",
          subscriptionId: null,
        }
      });
      
      return NextResponse.json({
        subscriptionStatus: "inactive",
        subscriptionPlan: "free"
      });
    }
    
    // Get the latest subscription
    const subscription = subscriptions.data[0];
    const status = subscription.status;
    const plan = subscription.items.data[0].price.nickname || 'premium';
    
    console.log(`Found subscription with status: ${status}, plan: ${plan}`);
    
    // Update user with subscription info
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        subscriptionId: subscription.id,
        subscriptionStatus: status,
        subscriptionPlan: plan,
      },
    });
    
    console.log(`Updated user subscription data:`, {
      subscriptionId: updatedUser.subscriptionId,
      subscriptionStatus: updatedUser.subscriptionStatus,
      subscriptionPlan: updatedUser.subscriptionPlan
    });
    
    return NextResponse.json({
      subscriptionStatus: updatedUser.subscriptionStatus,
      subscriptionPlan: updatedUser.subscriptionPlan
    });
  } catch (error) {
    console.error('Error refreshing subscription:', error);
    return NextResponse.json({ error: "Failed to refresh subscription data" }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic'; // Don't cache this route
