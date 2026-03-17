import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { addCredits } from "@/lib/credits";

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(req: NextRequest) {
  if (!WEBHOOK_SECRET) {
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 }
    );
  }

  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 }
    );
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, WEBHOOK_SECRET);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Webhook signature verification failed:", message);
    return NextResponse.json(
      { error: `Webhook Error: ${message}` },
      { status: 400 }
    );
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const { userId, packageId, credits } = session.metadata || {};

    if (!userId || !credits) {
      console.error("Missing metadata in checkout session:", session.id);
      return NextResponse.json({ error: "Missing metadata" }, { status: 400 });
    }

    const creditAmount = parseInt(credits, 10);
    if (isNaN(creditAmount) || creditAmount <= 0) {
      console.error("Invalid credits amount:", credits);
      return NextResponse.json({ error: "Invalid credits" }, { status: 400 });
    }

    try {
      await addCredits(
        userId,
        creditAmount,
        "PURCHASE",
        `Stripe purchase: ${creditAmount} credits (package: ${packageId})`,
        session.id
      );
      console.log(`Added ${creditAmount} credits to user ${userId} via Stripe session ${session.id}`);
    } catch (err) {
      console.error("Failed to add credits:", err);
      return NextResponse.json(
        { error: "Failed to process payment" },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ received: true });
}
