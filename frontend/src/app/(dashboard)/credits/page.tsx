"use client";

import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useCredits, useCreditPackages, usePurchaseCredits, useTransactions } from "@/hooks/use-credits";

export default function CreditsPage() {
  const t = useTranslations("credits");
  const { data: userData, isLoading: creditsLoading } = useCredits();
  const { data: packages, isLoading: packagesLoading } = useCreditPackages();
  const { data: txData, isLoading: txLoading } = useTransactions();
  const purchaseMutation = usePurchaseCredits();

  const creditPackages = packages || [];
  const userCredits = userData?.credits || 0;
  const transactions = txData?.transactions || [];

  const typeColors: Record<string, string> = {
    PURCHASE: "text-green-500",
    USAGE: "text-red-500",
    REFUND: "text-blue-500",
    ADMIN_GRANT: "text-green-500",
    ADMIN_REVOKE: "text-red-500",
    BONUS: "text-purple-500",
  };

  const handlePurchase = async (packageId: string) => {
    try {
      const result: any = await purchaseMutation.mutateAsync(packageId);
      // Redirect to Stripe Checkout
      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
      } else {
        toast.success(t("purchaseSuccess"));
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("purchaseError"));
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <Badge variant="secondary" className="text-lg px-4 py-2">
          {creditsLoading ? "..." : userCredits} {t("creditsUnit")}
        </Badge>
      </div>

      {/* Packages */}
      {packagesLoading ? (
        <div className="grid gap-4 md:grid-cols-3">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-48" />)}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {creditPackages.map((pkg) => (
            <Card key={pkg.id}>
              <CardHeader>
                <CardTitle className="text-center">{pkg.name}</CardTitle>
              </CardHeader>
              <CardContent className="text-center space-y-4">
                <div className="text-3xl font-bold">{pkg.credits}</div>
                <div className="text-sm text-muted-foreground">{t("creditsUnit")}</div>
                <div className="text-xl font-semibold">{pkg.priceTRY} TL</div>
                <Button
                  className="w-full"
                  onClick={() => handlePurchase(pkg.id)}
                  disabled={purchaseMutation.isPending}
                >
                  {purchaseMutation.isPending ? "..." : t("buy")}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Transaction History */}
      <Card>
        <CardHeader>
          <CardTitle>{t("transactionHistory")}</CardTitle>
        </CardHeader>
        <CardContent>
          {txLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12" />)}
            </div>
          ) : transactions.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">{t("noTransactions")}</p>
          ) : (
            <div className="space-y-2">
              {transactions.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between border-b py-2 last:border-0">
                  <div>
                    <span className="font-medium">{t(`type.${tx.type}`)}</span>
                    {tx.description && (
                      <p className="text-sm text-muted-foreground">{tx.description}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {new Date(tx.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={`font-medium ${typeColors[tx.type] || ""}`}>
                      {tx.amount > 0 ? "+" : ""}{tx.amount}
                    </span>
                    <p className="text-xs text-muted-foreground">
                      {t("balance")}: {tx.balance}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
