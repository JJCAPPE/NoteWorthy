import axios from "axios";
import React, { useState } from "react";
import OfferList from "./OfferList";
import { Price } from "@/types/price";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

interface PricingBoxProps {
  product: Price;
  currentPlan?: string;
  subscriptionStatus?: string;
  isLoading?: boolean;
}

const PricingBox = ({ 
  product, 
  currentPlan = "", 
  subscriptionStatus = "",
  isLoading: pageIsLoading = false 
}: PricingBoxProps) => {
  const { data: session } = useSession();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  
  const isCurrentPlan = currentPlan?.toLowerCase() === product.nickname.toLowerCase();
  const isPremiumPlan = product.nickname.toLowerCase() === "premium";
  const isLifetimePlan = product.isLifetime === true;
  const isFreePlan = product.nickname.toLowerCase() === "free";
  const hasActiveSubscription = subscriptionStatus === "active";
  const hasLifetimeAccess = currentPlan?.toLowerCase() === "lifetime premium";
  
  // Handle subscription purchase
  const handleSubscription = async (e: any) => {
    e.preventDefault();
    
    // Check if user is authenticated
    if (!session) {
      // Redirect to login page if not authenticated
      toast.error('You need to be signed in to purchase a subscription');
      router.push('/signin');
      return;
    }
    
    try {
      setIsLoading(true);
      const { data } = await axios.post(
        "/api/payment",
        {
          priceId: product.id,
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
      window.location.assign(data);
    } catch (error) {
      console.error('Error creating checkout session:', error);
      toast.error('Failed to start checkout process. Please try again.');
      setIsLoading(false);
    }
  };
  
  // Handle subscription cancellation
  const handleCancelSubscription = async (e: any) => {
    e.preventDefault();
    
    if (!session) {
      toast.error('You need to be signed in to cancel your subscription');
      router.push('/signin');
      return;
    }
    
    // Confirm cancellation
    if (!confirm('Are you sure you want to cancel your premium subscription? You will lose access to premium features at the end of your billing period.')) {
      return;
    }
    
    try {
      setIsLoading(true);
      const response = await fetch('/api/user/cancel-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      
      if (response.ok) {
        toast.success('Your subscription will be canceled at the end of the billing period');
        router.refresh(); // Refresh the page to update subscription status
      } else {
        toast.error(data.error || 'Failed to cancel subscription');
      }
    } catch (error) {
      console.error('Error canceling subscription:', error);
      toast.error('Failed to cancel subscription. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full px-4 md:w-1/2 lg:w-1/3">
      <div
        className={`relative z-10 mb-10 overflow-hidden rounded-xl ${
          isCurrentPlan && hasActiveSubscription 
            ? "border-2 border-primary" 
            : ""
        } bg-white px-8 py-10 shadow-[0px_0px_40px_0px_rgba(0,0,0,0.08)] dark:bg-dark-2 sm:p-12 lg:px-6 lg:py-10 xl:p-14`}
        data-wow-delay=".1s"
      >
        {isCurrentPlan && hasActiveSubscription && (
          <p className="absolute left-0 top-0 bg-primary px-4 py-1 text-sm font-medium text-white">
            Current Plan
          </p>
        )}
        
        {product.nickname === "Premium" && !isCurrentPlan && (
          <p className="absolute right-[-50px] top-[60px] inline-block -rotate-90 rounded-bl-md rounded-tl-md bg-primary px-5 py-2 text-base font-medium text-white">
            Recommended
          </p>
        )}
        
        <span className="mb-5 block text-xl font-medium text-dark dark:text-white">
          {product.nickname}
        </span>
        <h2 className="mb-11 text-4xl font-semibold text-dark dark:text-white xl:text-[42px] xl:leading-[1.21]">
          <span className="text-xl font-medium">$ </span>
          <span className="-ml-1 -tracking-[2px]">
            {(product.unit_amount / 100).toLocaleString("en-US", {
              currency: "USD",
            })}
          </span>
          <span className="text-base font-normal text-body-color dark:text-dark-6">
            {" "}
            {product.unit_amount > 0 ? (product.billingInterval === "month" ? "Per Month" : "One-time") : ""}
          </span>
        </h2>

        <div className="mb-[50px]">
          <h3 className="mb-5 text-lg font-medium text-dark dark:text-white">
            Features
          </h3>
          <div className="mb-10">
            {product?.offers.map((offer, i) => (
              <OfferList key={i} text={offer} />
            ))}
          </div>
        </div>
        
        <div className="w-full">
          {/* Disable button during page loading */}
          {pageIsLoading ? (
            <button 
              disabled
              className="inline-block w-full rounded-md bg-gray-400 px-7 py-3 text-center text-base font-medium text-white transition duration-300 cursor-not-allowed"
            >
              Loading...
            </button>
          ) : (
            <>
              {/* For Premium plan when user is on Free plan */}
              {isPremiumPlan && !isCurrentPlan && !hasLifetimeAccess && (
                <button
                  onClick={handleSubscription}
                  disabled={isLoading}
                  className="inline-block w-full rounded-md bg-primary px-7 py-3 text-center text-base font-medium text-white transition duration-300 hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Loading...' : 'Upgrade to Premium'}
                </button>
              )}
              
              {/* For Lifetime Premium plan */}
              {isLifetimePlan && !isCurrentPlan && !hasLifetimeAccess && (
                <button
                  onClick={handleSubscription}
                  disabled={isLoading}
                  className="inline-block w-full rounded-md bg-primary px-7 py-3 text-center text-base font-medium text-white transition duration-300 hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Loading...' : 'Get Lifetime Access'}
                </button>
              )}
              
              {/* For Free plan when user is on Premium plan */}
              {isFreePlan && hasActiveSubscription && !isCurrentPlan && !hasLifetimeAccess && (
                <button
                  onClick={handleCancelSubscription}
                  disabled={isLoading}
                  className="inline-block w-full rounded-md bg-red-500 px-7 py-3 text-center text-base font-medium text-white transition duration-300 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Loading...' : 'Cancel Premium'}
                </button>
              )}
              
              {/* For plans when user has lifetime access - disabled */}
              {hasLifetimeAccess && !isLifetimePlan && (
                <button
                  disabled
                  className="inline-block w-full rounded-md bg-gray-400 px-7 py-3 text-center text-base font-medium text-white transition duration-300 cursor-not-allowed"
                >
                  Lifetime Access Active
                </button>
              )}
              
              {/* Current plan */}
              {isCurrentPlan && (hasActiveSubscription || isLifetimePlan) && (
                <button
                  disabled
                  className="inline-block w-full rounded-md bg-green-500 px-7 py-3 text-center text-base font-medium text-white transition duration-300 cursor-not-allowed"
                >
                  Current Plan
                </button>
              )}
              
              {/* Default button for Free plan when not subscribed */}
              {isFreePlan && !hasActiveSubscription && (
                <button
                  disabled
                  className="inline-block w-full rounded-md bg-green-500 px-7 py-3 text-center text-base font-medium text-white transition duration-300 cursor-not-allowed"
                >
                  Free Plan - Current
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default PricingBox;
