import { NextResponse } from "next/server";
import Stripe from "stripe";

export async function GET() {
  try {
    console.log('Testing Stripe checkout...');
    
    // Check required environment variables
    if (!process.env.STRIPE_SECRET_KEY) {
      console.error('Missing STRIPE_SECRET_KEY environment variable');
      return NextResponse.json({ error: "Server configuration error: Missing STRIPE_SECRET_KEY" }, { status: 500 });
    }
    
    if (!process.env.SITE_URL) {
      console.error('Missing SITE_URL environment variable');
      return NextResponse.json({ error: "Server configuration error: Missing SITE_URL" }, { status: 500 });
    }
    
    console.log('STRIPE_SECRET_KEY:', process.env.STRIPE_SECRET_KEY?.substring(0, 8) + '...');
    console.log('SITE_URL:', process.env.SITE_URL);
    
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2023-10-16",
    });
    
    // Get the first active price
    const prices = await stripe.prices.list({
      active: true,
      limit: 1,
      expand: ['data.product']
    });
    
    if (prices.data.length === 0) {
      return NextResponse.json({ error: "No active prices found in your Stripe account" }, { status: 404 });
    }
    
    const price = prices.data[0];
    console.log('Using price:', price.id);
    
    // Create a basic checkout session without customer ID
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: price.id,
          quantity: 1,
        },
      ],
      mode: price.type === 'recurring' ? 'subscription' : 'payment',
      success_url: `${process.env.SITE_URL}/dashboard?success=true`,
      cancel_url: `${process.env.SITE_URL}/pricing?canceled=true`,
    });
    
    return NextResponse.json({ 
      success: true,
      checkoutUrl: session.url,
      price: {
        id: price.id,
        amount: price.unit_amount,
        currency: price.currency,
        type: price.type
      }
    });
  } catch (error) {
    console.error('Stripe checkout test error:', error);
    if (error instanceof Error) {
      return NextResponse.json({ 
        error: 'Stripe checkout test failed', 
        message: error.message,
        name: error.name
      }, { status: 500 });
    }
    return NextResponse.json({ error: 'Stripe checkout test failed' }, { status: 500 });
  }
}
