import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/lib/auth.config";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  trustHost: true,
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      // Refresh user data from DB on each token refresh
      if (token.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { role: true, credits: true, locale: true, theme: true },
        });
        if (dbUser) {
          token.role = dbUser.role;
          token.credits = dbUser.credits;
          token.locale = dbUser.locale;
          token.theme = dbUser.theme;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token) {
        const u = session.user as unknown as Record<string, unknown>;
        u.id = token.id;
        u.role = token.role;
        u.credits = token.credits;
        u.locale = token.locale;
        u.theme = token.theme;
      }
      return session;
    },
  },
});
