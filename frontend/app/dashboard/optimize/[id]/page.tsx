/**
 * Optimization page — /dashboard/optimize/[id]
 *
 * Server Component: fetches the strategy, resolves the catalog item,
 * then renders the client-side OptimizeClient.
 */

import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getStrategy } from "@/lib/actions/strategies";
import { getCatalogItem } from "@/lib/strategy-catalog";
import { OptimizeClient } from "@/components/optimization/optimize-client";
import type { BuiltInStrategyType } from "@/lib/types";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function OptimizePage({ params }: PageProps) {
  const { id } = await params;

  const strategy = await getStrategy(id);
  if (!strategy) notFound();
  if (strategy.type === "CUSTOM") notFound();
  const optimizableStrategy = strategy as typeof strategy & {
    type: BuiltInStrategyType;
  };

  const catalog = getCatalogItem(strategy.type);
  if (!catalog) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard"
          className="text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Back to workspace"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-xl font-semibold">
            Optimize: {strategy.name || strategy.ticker}
          </h1>
          <p className="text-sm text-muted-foreground">
            {catalog.label} · {strategy.ticker}
          </p>
        </div>
      </div>

      {/* Client-side orchestrator */}
      <OptimizeClient strategy={optimizableStrategy} catalog={catalog} />
    </div>
  );
}
