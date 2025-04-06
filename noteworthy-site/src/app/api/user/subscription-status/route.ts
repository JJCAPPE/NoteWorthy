import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/utils/auth";
import { hasActivePremiumSubscription } from "@/utils/subscriptionCheck";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json({ isPremium: false }, { status: 401 });
    }
    
    const userId = session.user.id as string;
    if (!userId) {
      return NextResponse.json({ isPremium: false }, { status: 400 });
    }
    
    const isPremium = await hasActivePremiumSubscription(userId);
    
    return NextResponse.json({ isPremium });
  } catch (error) {
    console.error('Error checking subscription status:', error);
    return NextResponse.json({ error: 'Failed to check subscription status' }, { status: 500 });
  }
}
