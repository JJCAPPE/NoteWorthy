import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getServerSession } from "next-auth";
import { authOptions } from "@/utils/auth";
import { prisma } from "@/utils/prismaDB";

// Import the price IDs for checking lifetime subscription
import { pricingData } from "@/stripe/pricingData";

export async function POST(request: NextRequest) {
  try {
    // Check required environment variables
    if (!process.env.STRIPE_SECRET_KEY) {
      console.error('Missing STRIPE_SECRET_KEY environment variable');
      return NextResponse.json({ error: "Server configuration error: Missing STRIPE_SECRET_KEY" }, { status: 500 });
    }
    
    if (!process.env.SITE_URL) {
      console.error('Missing SITE_URL environment variable');
      return NextResponse.json({ error: "Server configuration error: Missing SITE_URL" }, { status: 500 });
    }
    
    // Initialize Stripe
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2025-03-31.basil" as any, // Cast to any to bypass TypeScript error
    });
    
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
    
    // Parse request body
    const data = await request.json();
    const priceId = data.priceId;
    
    if (!priceId) {
      return NextResponse.json({ error: "Missing price ID" }, { status: 400 });
    }
    
    console.log('Processing checkout for user ID:', userId, 'with price ID:', priceId);
    
    // Try to find the user
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });
    
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    
    let customerId = user.stripeCustomerId;
    console.log('User found, existing customer ID:', customerId || 'none');
    
    // Create customer if needed
    if (!customerId) {
      try {
        const customer = await stripe.customers.create({
          email: user.email || undefined,
          name: user.name || undefined,
          metadata: { userId },
        });
        
        customerId = customer.id;
        console.log('Created new Stripe customer:', customerId);
        
        // Update user with new customer ID
        await prisma.user.update({
          where: { id: userId },
          data: { stripeCustomerId: customerId },
        });
      } catch (error) {
        console.error('Failed to create Stripe customer:', error);
        return NextResponse.json({ error: "Failed to create customer" }, { status: 500 });
      }
    }
    
    // Determine if this is a one-time payment or subscription
    // First, get the price details to check if it's a one-time payment
    const price = await stripe.prices.retrieve(priceId);
    console.log('Price details from Stripe:', {
      id: price.id,
      nickname: price.nickname,
      type: price.type,
      recurring: price.recurring
    });
    
    // Check if this is the lifetime plan price ID
    // More reliable to check based on the price type from Stripe
    const isLifetimePayment = price.type === 'one_time' || 
                          (price.recurring === null) || 
                          pricingData.some(p => p.id === priceId && p.isLifetime);
    console.log(`Creating ${isLifetimePayment ? 'one-time payment' : 'subscription'} checkout session for user:`, userId);
    
    // Create checkout session with metadata to help with webhook processing
    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: isLifetimePayment ? 'payment' : 'subscription',
      success_url: `${process.env.SITE_URL}/dashboard?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.SITE_URL}/pricing?canceled=true`,
      metadata: {
        userId: userId, // Add user ID to metadata for webhook processing
        isLifetime: isLifetimePayment ? 'true' : 'false',
      },
    });
    
    console.log('Checkout session created successfully. URL:', checkoutSession.url);
    return NextResponse.json(checkoutSession.url);
  } catch (error) {
    // Detailed error logging
    if (error instanceof Error) {
      console.error('Error creating checkout session:', {
        message: error.message,
        name: error.name,
        stack: error.stack,
      });
    } else {
      console.error('Unknown error creating checkout session:', error);
    }
    return NextResponse.json({ error: 'Failed to create checkout session. Please try again later.' }, { status: 500 });
  }
}
