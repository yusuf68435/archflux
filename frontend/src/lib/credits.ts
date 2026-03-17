import { prisma } from "@/lib/prisma";

/** Credit cost per job type */
export const JOB_COSTS = {
  FULL_CONVERSION: 2,
  PARTIAL_SPLIT: 3,
  DETAIL_EXTRACTION: 1,
  AUTO_CODING: 1,
} as const;

export type JobType = keyof typeof JOB_COSTS;

/**
 * Atomically deduct credits from a user's balance.
 * Returns the new balance, or throws if insufficient credits.
 */
export async function deductCredits(
  userId: string,
  jobType: JobType,
  jobId: string
): Promise<number> {
  const cost = JOB_COSTS[jobType];

  // Use a transaction for atomicity
  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: { credits: true },
    });

    if (user.credits < cost) {
      throw new Error(
        `Insufficient credits. Required: ${cost}, Available: ${user.credits}`
      );
    }

    const newBalance = user.credits - cost;

    await tx.user.update({
      where: { id: userId },
      data: { credits: newBalance },
    });

    await tx.creditTransaction.create({
      data: {
        userId,
        amount: -cost,
        balance: newBalance,
        type: "USAGE",
        description: `Job: ${jobType}`,
        jobId,
      },
    });

    return newBalance;
  });

  return result;
}

/**
 * Add credits to a user's balance (purchase, refund, admin grant).
 */
export async function addCredits(
  userId: string,
  amount: number,
  type: "PURCHASE" | "REFUND" | "ADMIN_GRANT" | "BONUS",
  description?: string,
  paymentRef?: string,
  jobId?: string
): Promise<number> {
  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: { credits: true },
    });

    const newBalance = user.credits + amount;

    await tx.user.update({
      where: { id: userId },
      data: { credits: newBalance },
    });

    await tx.creditTransaction.create({
      data: {
        userId,
        amount,
        balance: newBalance,
        type,
        description,
        paymentRef,
        jobId,
      },
    });

    return newBalance;
  });

  return result;
}
