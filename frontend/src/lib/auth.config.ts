import Google from "next-auth/providers/google";
import type { NextAuthConfig } from "next-auth";

// Edge-safe auth config (no Prisma adapter)
// Used by middleware which runs in Edge Runtime
// NOTE: session strategy NOT set here — Edge middleware uses JWT automatically.
// auth.ts overrides to "database" strategy with the PrismaAdapter.
export const authConfig: NextAuthConfig = {
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      checks: ["state"],
    }),
  ],
  pages: {
    signIn: "/login",
  },
};
