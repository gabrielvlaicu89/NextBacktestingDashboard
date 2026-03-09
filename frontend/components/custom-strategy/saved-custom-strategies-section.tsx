import Link from "next/link";
import { Plus, PencilLine } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { CustomStrategyDefinitionRecord } from "@/lib/types";

interface SavedCustomStrategiesSectionProps {
  definitions: CustomStrategyDefinitionRecord[];
}

export function SavedCustomStrategiesSection({
  definitions,
}: SavedCustomStrategiesSectionProps) {
  return (
    <section className="space-y-4" data-testid="saved-custom-strategies-section">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            Saved Custom Strategies
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Open a saved custom definition in the dedicated builder page.
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/build-custom-stratergy">
            <Plus className="h-4 w-4" />
            Build Custom Stratergy
          </Link>
        </Button>
      </div>

      {definitions.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No saved custom strategies yet</CardTitle>
            <CardDescription>
              Start on the dedicated custom builder page to create your first
              saved draft.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2" data-testid="saved-custom-strategy-grid">
          {definitions.map((definition) => (
            <Card key={definition.id} data-testid={`saved-custom-card-${definition.id}`}>
              <CardHeader>
                <CardTitle className="text-base">{definition.name}</CardTitle>
                <CardDescription>
                  {definition.description || "No description yet."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Version {definition.definitionVersion}
                </p>
                {definition.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {definition.tags.map((tag) => (
                      <Badge key={tag} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
              <CardFooter>
                <Button variant="outline" asChild>
                  <Link href={`/dashboard/build-custom-stratergy?id=${definition.id}`}>
                    <PencilLine className="h-4 w-4" />
                    Edit Draft
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}