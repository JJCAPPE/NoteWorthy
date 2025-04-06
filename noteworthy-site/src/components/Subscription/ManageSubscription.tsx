"use client";

import React, { useState } from 'react';
import { useSession } from 'next-auth/react';
import axios from 'axios';

interface SubscriptionProps {
  isPremium: boolean;
}

const ManageSubscription: React.FC<SubscriptionProps> = ({ isPremium }) => {
  const { data: session } = useSession();
  const [isLoading, setIsLoading] = useState(false);

  const handleSubscriptionPortal = async () => {
    if (!session?.user?.id) return;
    
    try {
      setIsLoading(true);
      const { data } = await axios.post('/api/payment/manage');
      window.location.assign(data);
    } catch (error) {
      console.error('Error opening subscription portal:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpgrade = async () => {
    if (!session?.user?.id) return;
    
    try {
      setIsLoading(true);
      const { data } = await axios.post(
        '/api/payment',
        { priceId: 'price_1NQk55LtGdPVhGLefU8AHqHr' },
        { headers: { 'Content-Type': 'application/json' } }
      );
      window.location.assign(data);
    } catch (error) {
      console.error('Error starting checkout:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!session) return null;

  return (
    <div className="bg-white dark:bg-dark-2 p-6 rounded-lg shadow-md">
      <h2 className="text-xl font-semibold mb-4 text-dark dark:text-white">
        {isPremium ? 'Your Premium Subscription' : 'Upgrade to Premium'}
      </h2>
      
      {isPremium ? (
        <>
          <p className="mb-4 text-body-color dark:text-dark-6">
            You currently have an active Premium subscription. Manage your subscription settings or billing information.
          </p>
          <button
            onClick={handleSubscriptionPortal}
            disabled={isLoading}
            className="inline-block rounded-md bg-primary px-6 py-3 text-center text-base font-medium text-white transition duration-300 hover:bg-primary/90 disabled:opacity-50"
          >
            {isLoading ? 'Loading...' : 'Manage Subscription'}
          </button>
        </>
      ) : (
        <>
          <p className="mb-4 text-body-color dark:text-dark-6">
            Upgrade to Premium to unlock exclusive features including saving PDFs to the cloud, custom prompts, and more.
          </p>
          <button
            onClick={handleUpgrade}
            disabled={isLoading}
            className="inline-block rounded-md bg-primary px-6 py-3 text-center text-base font-medium text-white transition duration-300 hover:bg-primary/90 disabled:opacity-50"
          >
            {isLoading ? 'Loading...' : 'Upgrade to Premium'}
          </button>
        </>
      )}
    </div>
  );
};

export default ManageSubscription;
