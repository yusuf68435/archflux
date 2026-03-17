import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const packages = await prisma.creditPackage.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
  });
  return NextResponse.json(packages);
}
