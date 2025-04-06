import { Price } from "@/types/price";

// Determine if we're in production or development
const isProduction = process.env.NODE_ENV === 'production';

// Define price IDs for both environments
const priceIds = {
  // Development/test price IDs
  development: {
    free: "",
    premium: "price_1RAHrYPSwWkKgzUlwTnwb4pi", // Replace with your test environment premium price ID
    lifetime: "price_1RAk31PSwWkKgzUl1tbFP87u" // For now, using the premium ID as placeholder
  },
  // Production price IDs
  production: {
    free: "",
    premium: "price_1RAjbuAWnDZptC3GN1gYJHVP",
    lifetime: "price_1RAkJAAWnDZptC3GN1fNVPza"
  }
};

// Select the right set of price IDs based on environment
const prices = isProduction ? priceIds.production : priceIds.development;

export const pricingData: Price[] = [
  {
    id: prices.free,
    unit_amount: 0 * 100,
    nickname: "Free",
    billingInterval: "",
    offers: [
      "Unlimted Uses",
      "Download PDF",
      "Copy Latex source code",
      "Adjust Note Size",
      "OpenSource Code"
    ],
  },
  {
    id: prices.premium,
    unit_amount: 10 * 100,
    nickname: "Premium",
    billingInterval: "month",
    offers: [
      "All free features",
      "Save your PDF's + Latex on cloud",
      "Prompt NoteWorthy to fine tune generation",
      "Select between different models",
      "24/7 Support",
    ],
  },
  {
    id: prices.lifetime,
    unit_amount: 50 * 100,
    nickname: "Lifetime Premium",
    isLifetime: true,
    billingInterval: "one-time",
    offers: [
      "All premium features",
      "One-time payment",
      "Lifetime access",
      "No recurring charges",
      "24/7 Support",
    ],
  },
];
