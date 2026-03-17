import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCreditStore } from "@/stores/credit-store";
import type { User } from "@/types/user";
import type { CreditPackage, CreditTransaction } from "@/types/credits";

// ---------- Types ----------

interface PurchasePayload {
  packageId: string;
}

interface PurchaseResponse {
  success: boolean;
  newBalance: number;
  transactionId: string;
}

interface TransactionsResponse {
  transactions: CreditTransaction[];
  total: number;
  page: number;
  pageSize: number;
}

// ---------- API helpers ----------

async function fetchJson<T>(
  url: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message ?? `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

// ---------- Hooks ----------

/**
 * Fetches the current user profile and syncs the credit balance to the zustand store.
 */
export function useCredits() {
  const setBalance = useCreditStore((s) => s.setBalance);

  const query = useQuery<User>({
    queryKey: ["user", "me"],
    queryFn: () => fetchJson<User>("/api/user/me"),
  });

  useEffect(() => {
    if (query.data) {
      setBalance(query.data.credits);
    }
  }, [query.data, setBalance]);

  return query;
}

/**
 * Fetches available credit packages.
 */
export function useCreditPackages() {
  return useQuery<CreditPackage[]>({
    queryKey: ["credit-packages"],
    queryFn: () => fetchJson<CreditPackage[]>("/api/credits/packages"),
  });
}

/**
 * Mutation to purchase a credit package.
 * Accepts either a packageId string or a PurchasePayload object.
 */
export function usePurchaseCredits() {
  const queryClient = useQueryClient();
  const setBalance = useCreditStore((s) => s.setBalance);

  return useMutation({
    mutationFn: (packageIdOrPayload: string | PurchasePayload) => {
      const payload: PurchasePayload =
        typeof packageIdOrPayload === "string"
          ? { packageId: packageIdOrPayload }
          : packageIdOrPayload;
      return fetchJson<PurchaseResponse>("/api/credits/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    },
    onSuccess: (data) => {
      setBalance(data.newBalance);
      queryClient.invalidateQueries({ queryKey: ["user", "me"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
  });
}

/**
 * Paginated query for credit transaction history.
 */
export function useTransactions(page: number = 1) {
  return useQuery<TransactionsResponse>({
    queryKey: ["transactions", page],
    queryFn: () =>
      fetchJson<TransactionsResponse>(`/api/credits/transactions?page=${page}`),
  });
}
