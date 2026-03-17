import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/lib/auth.config";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "database",
  },
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        // Fetch extra user fields
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { role: true, credits: true, locale: true, theme: true },
        });
        if (dbUser) {
          const u = session.user as unknown as Record<string, unknown>;
          u.role = dbUser.role;
          u.credits = dbUser.credits;
          u.locale = dbUser.locale;
          u.theme = dbUser.theme;
        }
      }
      return session;
    },
  },
});
