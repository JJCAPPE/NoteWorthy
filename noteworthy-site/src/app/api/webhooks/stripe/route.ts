import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/utils/prismaDB";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-03-31.basil" as any, // Cast to any to bypass TypeScript error
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(request: NextRequest) {
  console.log('===== Stripe webhook received =====');
  
  // Debug environment variables
  console.log('STRIPE_WEBHOOK_SECRET configured:', !!process.env.STRIPE_WEBHOOK_SECRET);
  console.log('STRIPE_SECRET_KEY configured:', !!process.env.STRIPE_SECRET_KEY);
  
  // Log the raw body length to make sure we're getting the full content
  const body = await request.text();
  console.log('Request body length:', body.length);
  
  const signature = request.headers.get("stripe-signature") as string;
  console.log('Webhook signature:', signature ? 'Present' : 'Missing');
  
  if (!webhookSecret) {
    console.error('ERROR: Webhook secret is not configured!');
    return NextResponse.json({ error: 'Webhook secret is not configured' }, { status: 500 });
  }
  
  let event: Stripe.Event;
  
  try {
    console.log('Attempting to construct event with webhook secret:', webhookSecret.substring(0, 5) + '...');
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    console.log('Webhook event constructed successfully. Type:', event.type);
  } catch (error: any) {
    console.error(`Webhook signature verification failed: ${error.message}`);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  let subscription: Stripe.Subscription;
  let status: string;

  // Handle the event
  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      subscription = event.data.object as Stripe.Subscription;
      status = subscription.status;

      // Find the customer in our database
      const customer = await stripe.customers.retrieve(subscription.customer as string);
      if (customer.deleted) {
        // Handle deleted customer
        break;
      }

      // Get the user ID from customer metadata
      const userId = customer.metadata.userId;
      if (!userId) {
        console.log('No userId in customer metadata!');
        break;
      }

      // Get subscription details
      const plan = subscription.items.data[0].price.nickname || 'premium';
      
      console.log('Subscription data to update:', {
        userId,
        subscriptionId: subscription.id,
        status,
        plan,
        priceId: subscription.items.data[0].price.id,
        customer: customer.id
      });

      try {
        // Update the user's subscription information
        const updatedUser = await prisma.user.update({
          where: {
            id: userId,
          },
          data: {
            subscriptionId: subscription.id,
            subscriptionStatus: status,
            subscriptionPlan: plan,
          },
        });
        
        console.log(`Successfully updated user ${userId} with subscription data:`, {
          subscriptionId: updatedUser.subscriptionId,
          subscriptionStatus: updatedUser.subscriptionStatus,
          subscriptionPlan: updatedUser.subscriptionPlan
        });
      } catch (error) {
        console.error(`Failed to update user ${userId} subscription data:`, error);
      }
      break;

    default:
      console.log(`Unhandled event type: ${event.type}`);
  }

  return NextResponse.json({ received: true }, { status: 200 });
}

// Next.js App Router configuration for webhook
// This tells Next.js not to parse the body of this route
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// The correct config format for App Router
export const preferredRegion = 'auto';
