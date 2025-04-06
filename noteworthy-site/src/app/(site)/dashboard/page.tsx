"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export default function DashboardPage() {
  const searchParams = useSearchParams();
  const success = searchParams.get("success");
  const { data: session } = useSession();
  const [isLoading, setIsLoading] = useState(true);
  const [subscriptionData, setSubscriptionData] = useState({
    status: "",
    plan: ""
  });

  useEffect(() => {
    if (session?.user) {
      // Fetch user subscription data after successful payment
      const fetchSubscriptionData = async () => {
        try {
          setIsLoading(true);
          
          // If we've just completed a payment, refresh the subscription data directly from Stripe
          // This bypasses any webhook issues
          if (success === "true") {
            console.log("Payment success detected, refreshing subscription from Stripe");
            const refreshResponse = await fetch("/api/user/refresh-subscription");
            const refreshData = await refreshResponse.json();
            
            if (refreshResponse.ok) {
              console.log("Subscription refreshed:", refreshData);
              setSubscriptionData({
                status: refreshData.subscriptionStatus || "inactive",
                plan: refreshData.subscriptionPlan || "free"
              });
              return;
            }
          }
          
          // Fallback to regular subscription endpoint
          const response = await fetch("/api/user/subscription");
          const data = await response.json();
          
          if (response.ok) {
            setSubscriptionData({
              status: data.subscriptionStatus || "inactive",
              plan: data.subscriptionPlan || "free"
            });
          }
        } catch (error) {
          console.error("Error fetching subscription data:", error);
        } finally {
          setIsLoading(false);
        }
      };

      fetchSubscriptionData();
    }
  }, [session, success]);

  return (
    <div className="container max-w-5xl py-20">
      {success === "true" && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-6" role="alert">
          <p className="font-bold">Payment Successful!</p>
          <p>Thank you for your subscription. Your account has been updated.</p>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Subscription</CardTitle>
            <CardDescription>Your current subscription details</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p>Loading subscription details...</p>
            ) : (
              <div className="space-y-2">
                <div>
                  <span className="font-semibold">Status: </span>
                  <span className={subscriptionData.status === "active" ? "text-green-600" : "text-gray-500"}>
                    {subscriptionData.status === "active" ? "Active" : "Inactive"}
                  </span>
                </div>
                <div>
                  <span className="font-semibold">Plan: </span>
                  <span className="capitalize">{subscriptionData.plan || "Free"}</span>
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Link href="/pricing">
              <Button variant="outline">Manage Subscription</Button>
            </Link>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Things you can do</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Link href="/convert">
              <Button className="w-full">Convert Notes</Button>
            </Link>
            <Link href="/saved">
              <Button className="w-full" variant="outline">View Saved Notes</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
