import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "@/components/providers/session-provider";
import { ReduxProvider } from "@/store/provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { getServerSession } from "@/lib/auth";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Trading Backtester",
  description: "Build, run, and compare algorithmic trading strategies",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Pre-fetch the session on the server so SessionProvider doesn't need
  // an extra round-trip to hydrate the client-side session cache.
  const session = await getServerSession();

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <SessionProvider session={session}>
            <ReduxProvider>
              {children}
            </ReduxProvider>
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
