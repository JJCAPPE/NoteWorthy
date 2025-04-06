import { NextResponse } from "next/server";
import Stripe from "stripe";

export async function GET() {
  try {
    console.log('Testing Stripe configuration...');
    
    // Check required environment variables
    if (!process.env.STRIPE_SECRET_KEY) {
      console.error('Missing STRIPE_SECRET_KEY environment variable');
      return NextResponse.json({ error: "Server configuration error: Missing STRIPE_SECRET_KEY" }, { status: 500 });
    }
    
    console.log('Initializing Stripe...');
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2023-10-16",
    });
    
    console.log('Fetching Stripe products...');
    const products = await stripe.products.list({ limit: 3 });
    
    console.log('Fetching Stripe prices...');
    const prices = await stripe.prices.list({ limit: 3 });
    
    return NextResponse.json({ 
      success: true, 
      stripeConnected: true,
      productCount: products.data.length,
      priceCount: prices.data.length,
      sampleProducts: products.data.map(p => ({
        id: p.id,
        name: p.name,
        active: p.active
      })),
      samplePrices: prices.data.map(p => ({
        id: p.id,
        product: p.product,
        unit_amount: p.unit_amount,
        currency: p.currency,
        active: p.active,
        type: p.type
      }))
    });
  } catch (error) {
    console.error('Stripe test error:', error);
    if (error instanceof Error) {
      return NextResponse.json({ 
        error: 'Stripe test failed', 
        message: error.message,
        name: error.name
      }, { status: 500 });
    }
    return NextResponse.json({ error: 'Stripe test failed' }, { status: 500 });
  }
}
