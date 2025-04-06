"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import SectionTitle from "../Common/SectionTitle";
import PricingBox from "./PricingBox";
import { pricingData } from "@/stripe/pricingData";
import { useSearchParams } from "next/navigation";
import toast from "react-hot-toast";

const Pricing = () => {
  const { data: session } = useSession();
  const [isLoading, setIsLoading] = useState(true);
  const [currentSubscription, setCurrentSubscription] = useState<{
    status: string;
    plan: string;
  }>({
    status: "",
    plan: ""
  });
  const searchParams = useSearchParams();
  const canceled = searchParams.get("canceled");
  
  useEffect(() => {
    if (canceled === "true") {
      toast.error("Payment canceled. You can try again when you're ready.");
    }
  }, [canceled]);
  
  useEffect(() => {
    const fetchSubscriptionData = async () => {
      if (!session?.user) {
        setIsLoading(false);
        return;
      }
      
      try {
        const response = await fetch("/api/user/subscription");
        const data = await response.json();
        
        if (response.ok) {
          setCurrentSubscription({
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
  }, [session]);
  
  return (
    <section
      id="pricing"
      className="relative z-20 overflow-hidden bg-white pb-12 pt-20 dark:bg-dark lg:pb-[90px] lg:pt-[120px]"
    >
      <div className="container">
        <div className="mb-[60px]">
          <SectionTitle
            subtitle="Pricing Table"
            title="Our Pricing Plan"
            paragraph="NoteWorthy offers a completely free version of the complete service, with ability to dowload generated PDF's and Latex code. If you want to save your work, tweak prompts and try different generation models, there is a paid plan available."
            center
          />
          
          {session?.user && !isLoading && currentSubscription.status === "active" && (
            <div className="mt-6 text-center">
              <p className="inline-block rounded-lg bg-green-100 px-4 py-2 text-green-800">
                You are currently on the <span className="font-semibold capitalize">{currentSubscription.plan}</span> plan
              </p>
            </div>
          )}
        </div>

        <div className="-mx-4 flex flex-wrap justify-center">
          {pricingData.map((product, i) => (
            <PricingBox 
              key={i} 
              product={product} 
              currentPlan={currentSubscription.plan?.toLowerCase()} 
              subscriptionStatus={currentSubscription.status}
              isLoading={isLoading}
            />
          ))}     
        </div>
      </div>
    </section>
  );
};

export default Pricing;
