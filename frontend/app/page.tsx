import { getServerSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { TrendingUp, BarChart3, GitCompareArrows, Zap } from "lucide-react";

export default async function LandingPage() {
  const session = await getServerSession();
  if (session) redirect("/dashboard");

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="flex h-14 items-center justify-between border-b px-6">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          <span className="text-lg font-semibold tracking-tight">
            Trading Backtester
          </span>
        </div>
        <Link
          href="/login"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          Sign In
        </Link>
      </header>

      {/* Hero */}
      <section className="flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
        <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">
          Build, Run, and Compare{" "}
          <span className="text-primary">Trading Strategies</span>
        </h1>
        <p className="mt-6 max-w-xl text-lg text-muted-foreground">
          Backtest algorithmic trading strategies against historical data.
          Analyse performance metrics, visualise equity curves, and optimise
          parameters — all in one platform.
        </p>
        <div className="mt-10">
          <Link
            href="/login"
            className="rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
          >
            Get Started
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="border-t bg-muted/40 px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-12 text-center text-2xl font-semibold tracking-tight">
            Everything you need to test your ideas
          </h2>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              icon={<Zap className="h-6 w-6" />}
              title="5 Built-in Strategies"
              description="Mean Reversion, MA Crossover, Earnings Drift, Pairs Trading, and Buy & Hold — ready to customise."
            />
            <FeatureCard
              icon={<BarChart3 className="h-6 w-6" />}
              title="Rich Analytics"
              description="Sharpe ratio, drawdown charts, monthly heatmaps, trade logs, and equity curves for every backtest."
            />
            <FeatureCard
              icon={<GitCompareArrows className="h-6 w-6" />}
              title="Side-by-Side Comparison"
              description="Compare multiple strategies and parameter sets to find what works best."
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-6 text-center text-sm text-muted-foreground">
        Built with Next.js, FastAPI, and Python.
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-6 shadow-sm">
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
        {icon}
      </div>
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
