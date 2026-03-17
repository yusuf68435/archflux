import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createCheckoutSession } from "@/lib/stripe";
import { rateLimitByIp } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") || "unknown";
  if (!rateLimitByIp(ip, "purchase", 5, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { packageId } = await req.json();

  const pkg = await prisma.creditPackage.findUnique({
    where: { id: packageId, active: true },
  });

  if (!pkg) {
    return NextResponse.json({ error: "Package not found" }, { status: 404 });
  }

  const origin = req.headers.get("origin") || "http://localhost:3000";

  const checkoutSession = await createCheckoutSession({
    userId: session.user.id,
    packageId: pkg.id,
    packageName: pkg.name,
    credits: pkg.credits,
    priceTRY: pkg.priceTRY,
    successUrl: `${origin}/credits?payment=success`,
    cancelUrl: `${origin}/credits?payment=cancelled`,
  });

  return NextResponse.json({
    checkoutUrl: checkoutSession.url,
  });
}
