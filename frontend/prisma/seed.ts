import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Seeding database...");

  // Credit Packages
  const packages = [
    {
      name: "Başlangıç",
      credits: 5,
      priceTRY: 49.99,
      priceUSD: 1.49,
      sortOrder: 1,
    },
    {
      name: "Standart",
      credits: 15,
      priceTRY: 129.99,
      priceUSD: 3.99,
      sortOrder: 2,
    },
    {
      name: "Profesyonel",
      credits: 50,
      priceTRY: 349.99,
      priceUSD: 10.99,
      sortOrder: 3,
    },
    {
      name: "Kurumsal",
      credits: 150,
      priceTRY: 899.99,
      priceUSD: 27.99,
      sortOrder: 4,
    },
  ];

  for (const pkg of packages) {
    await prisma.creditPackage.upsert({
      where: { id: pkg.name.toLowerCase() },
      update: pkg,
      create: { id: pkg.name.toLowerCase(), ...pkg },
    });
    console.log(`  ✅ Package: ${pkg.name} (${pkg.credits} credits)`);
  }

  console.log("\n🎉 Seeding complete!");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
