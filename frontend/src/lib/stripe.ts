import Stripe from "stripe";

// Lazy-initialize so the app doesn't crash when Stripe is not yet configured.
let _stripe: Stripe | null = null;

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || key === "BURAYA_EKLE") {
    throw new Error("Stripe not configured — set STRIPE_SECRET_KEY in the environment.");
  }
  if (!_stripe) {
    _stripe = new Stripe(key, { apiVersion: "2026-02-25.clover", typescript: true });
  }
  return _stripe;
}

// Proxy so existing code using `stripe.xxx` keeps working, but initialization
// only happens on first actual API call (not at module load time).
export const stripe = new Proxy({} as Stripe, {
  get(_t, prop) {
    return (getStripe() as unknown as Record<string, unknown>)[prop as string];
  },
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
