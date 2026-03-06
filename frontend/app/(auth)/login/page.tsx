import { getServerSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { LoginCard } from "@/components/auth/login-card";

export const metadata = {
  title: "Sign In — Trading Backtester",
};

export default async function LoginPage() {
  // Already authenticated → skip the login page
  const session = await getServerSession();
  if (session) redirect("/dashboard");

  return <LoginCard />;
}
