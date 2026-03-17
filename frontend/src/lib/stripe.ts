import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY environment variable is required");
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2026-02-25.clover",
  typescript: true,
});

/**
 * Create a Stripe Checkout session for purchasing a credit package.
 */
export async function createCheckoutSession({
  userId,
  packageId,
  packageName,
  credits,
  priceTRY,
  successUrl,
  cancelUrl,
}: {
  userId: string;
  packageId: string;
  packageName: string;
  credits: number;
  priceTRY: number;
  successUrl: string;
  cancelUrl: string;
}) {
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "try",
          product_data: {
            name: `${packageName} - ${credits} Kredi`,
            description: `ArchFlux kredi paketi: ${credits} kredi`,
          },
          unit_amount: Math.round(priceTRY * 100), // Stripe uses smallest currency unit (kuruş)
        },
        quantity: 1,
      },
    ],
    mode: "payment",
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      userId,
      packageId,
      credits: String(credits),
    },
  });

  return session;
}
