export type Price = {
  id: string;
  unit_amount: number;
  nickname: string;
  offers: string[];
  isLifetime?: boolean;
  billingInterval?: string;
};
