"use client";

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";
import { Session } from "next-auth";

interface Props {
  children: React.ReactNode;
  session?: Session | null;
}

/**
 * Thin client wrapper around NextAuth's SessionProvider.
 * Pass the server-fetched session from RootLayout to avoid an extra round-trip.
 */
export function SessionProvider({ children, session }: Props) {
  return (
    <NextAuthSessionProvider session={session}>
      {children}
    </NextAuthSessionProvider>
  );
}
