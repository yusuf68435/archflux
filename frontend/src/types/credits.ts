export interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  priceTRY: number;
  priceUSD?: number;
  active: boolean;
}

export type TransactionType =
  | "PURCHASE"
  | "USAGE"
  | "REFUND"
  | "ADMIN_GRANT"
  | "ADMIN_REVOKE"
  | "BONUS";

export interface CreditTransaction {
  id: string;
  userId: string;
  amount: number;
  balance: number;
  type: TransactionType;
  description?: string;
  jobId?: string;
  paymentRef?: string;
  createdAt: string;
}
