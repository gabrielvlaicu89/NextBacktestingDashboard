import { NextAuthOptions, getServerSession as nextAuthGetServerSession } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),

  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],

  session: {
    // JWT strategy: session is a signed cookie verified in proxy.ts without
    // a DB round-trip. User + Account rows are still written to the DB by the
    // Prisma adapter on first sign-in.
    strategy: "jwt",
  },

  pages: {
    signIn: "/login",
  },

  callbacks: {
    // Persist the database user id into the JWT on first sign-in
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    // Expose the user id on the session object available to Server Components
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
};

/**
 * Server-side helper — call this in Server Components and API route handlers.
 * Returns the current session, or null if the user is not authenticated.
 */
export const getServerSession = () => nextAuthGetServerSession(authOptions);
