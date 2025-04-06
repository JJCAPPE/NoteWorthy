import { prisma } from "./prismaDB";
import React from 'react';

/**
 * Check if a user has an active premium subscription
 * @param userId The user ID to check
 * @returns Boolean indicating if the user has an active premium subscription
 */
export async function hasActivePremiumSubscription(userId: string): Promise<boolean> {
  if (!userId) return false;
  
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        subscriptionStatus: true,
      },
    });

    if (!user) return false;
    
    // Check if the subscription is active
    // Since we don't have a separate subscriptionPlan field, we'll consider any active subscription as premium
    return user.subscriptionStatus === 'active';
  } catch (error) {
    console.error('Error checking subscription status:', error);
    return false;
  }
}

/**
 * A React hook to check if the current user is a premium subscriber
 * To be used in client components
 */
export function usePremiumStatus(session: any): { isPremium: boolean, isLoading: boolean } {
  const [isPremium, setIsPremium] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);
  
  React.useEffect(() => {
    const checkPremiumStatus = async () => {
      if (!session?.user?.id) {
        setIsPremium(false);
        setIsLoading(false);
        return;
      }
      
      try {
        const response = await fetch('/api/user/subscription-status');
        const data = await response.json();
        setIsPremium(data.isPremium);
      } catch (error) {
        console.error('Error checking premium status:', error);
        setIsPremium(false);
      } finally {
        setIsLoading(false);
      }
    };
    
    checkPremiumStatus();
  }, [session]);
  
  return { isPremium, isLoading };
}
