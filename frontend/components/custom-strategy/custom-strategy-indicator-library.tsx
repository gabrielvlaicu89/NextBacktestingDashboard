"use client";

import { useState } from "react";
import type { IndicatorNode } from "@/lib/types";
import { CUSTOM_INDICATOR_CATALOG, getCustomIndicatorCatalogItem } from "@/lib/custom-indicator-catalog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

interface CustomStrategyIndicatorLibraryProps {
  indicators: IndicatorNode[];
  onAddIndicator: (indicatorId: string) => void;
  onRemoveIndicator: (indicatorId: string) => void;
  onUpdateIndicatorLabel: (indicatorId: string, label: string) => void;
  onUpdateIndicatorParam: (
    indicatorId: string,
    key: string,
    value: string | number | boolean,
  ) => void;
  disabled?: boolean;
}

function groupCatalogByCategory(items: typeof CUSTOM_INDICATOR_CATALOG) {
  return items.reduce<Record<string, typeof CUSTOM_INDICATOR_CATALOG>>(
    (groups, indicator) => {
      if (!groups[indicator.category]) {
        groups[indicator.category] = [];
      }

      groups[indicator.category].push(indicator);
      return groups;
    },
    {},
  );
}

export function CustomStrategyIndicatorLibrary({
  indicators,
  onAddIndicator,
  onRemoveIndicator,
  onUpdateIndicatorLabel,
  onUpdateIndicatorParam,
  disabled = false,
}: CustomStrategyIndicatorLibraryProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredCatalog = normalizedQuery
    ? CUSTOM_INDICATOR_CATALOG.filter((indicator) => {
        const searchableText = [
          indicator.id,
          indicator.label,
          indicator.description,
          indicator.category,
          ...indicator.outputs,
        ]
          .join(" ")
          .toLowerCase();

        return searchableText.includes(normalizedQuery);
      })
    : CUSTOM_INDICATOR_CATALOG;
  const catalogGroups = groupCatalogByCategory(filteredCatalog);

  return (
    <div className="space-y-6" data-testid="custom-indicator-library">
      <div className="space-y-2">
        <div>
          <h2 className="text-base font-semibold">Indicator Library</h2>
          <p className="text-sm text-muted-foreground">
            Add reusable indicators to the draft, then tune their parameters before
            wiring them into rules.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="custom-indicator-search">Search Indicators</Label>
          <Input
            id="custom-indicator-search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search by name, category, or output"
            data-testid="custom-indicator-search-input"
            disabled={disabled}
          />
        </div>

        {filteredCatalog.length === 0 ? (
          <div
            className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground"
            data-testid="indicator-search-empty-state"
          >
            No indicators match the current search.
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {Object.entries(catalogGroups).map(([category, items]) => (
              <div key={category} className="rounded-lg border p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h3 className="text-sm font-medium">{category}</h3>
                  <Badge variant="secondary">{items.length}</Badge>
                </div>

                <div className="space-y-3">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-md border border-dashed p-3"
                      data-testid={`indicator-catalog-card-${item.id}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">{item.label}</p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {item.description}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => onAddIndicator(item.id)}
                          disabled={disabled}
                          data-testid={`add-indicator-${item.id}`}
                        >
                          Add
                        </Button>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-1">
                        {item.outputs.map((output) => (
                          <Badge key={output} variant="outline">
                            {output}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div>
          <h2 className="text-base font-semibold">Selected Indicators</h2>
          <p className="text-sm text-muted-foreground">
            These indicators will be available for upcoming rule-builder comparisons.
          </p>
        </div>

        {indicators.length === 0 ? (
          <div
            className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground"
            data-testid="no-selected-indicators"
          >
            No indicators added yet. Start by adding one from the library above.
          </div>
        ) : (
          <div className="space-y-4">
            {indicators.map((indicator) => {
              const catalogItem = getCustomIndicatorCatalogItem(indicator.indicatorId);

              if (!catalogItem) {
                return null;
              }

              return (
                <div
                  key={indicator.id}
                  className="rounded-lg border p-4"
                  data-testid={`selected-indicator-row-${indicator.id}`}
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="font-medium">{catalogItem.label}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {catalogItem.description}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => onRemoveIndicator(indicator.id)}
                      disabled={disabled}
                      data-testid={`remove-indicator-${indicator.id}`}
                    >
                      Remove
                    </Button>
                  </div>

                  <div className="mt-4 space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor={`custom-indicator-label-${indicator.id}`}>
                        Label
                      </Label>
                      <Input
                        id={`custom-indicator-label-${indicator.id}`}
                        value={indicator.label}
                        disabled={disabled}
                        onChange={(event) =>
                          onUpdateIndicatorLabel(indicator.id, event.target.value)
                        }
                        data-testid={`custom-indicator-label-${indicator.id}`}
                      />
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      {catalogItem.params.map((param) => {
                        const currentValue = indicator.params[param.key] ?? param.default;

                        if (param.type === "number") {
                          return (
                            <div key={param.key} className="space-y-2">
                              <Label htmlFor={`${indicator.id}-${param.key}`}>
                                {param.label}
                              </Label>
                              <Input
                                id={`${indicator.id}-${param.key}`}
                                type="number"
                                min={param.min}
                                max={param.max}
                                step={param.step ?? 1}
                                value={String(currentValue)}
                                disabled={disabled}
                                onChange={(event) =>
                                  onUpdateIndicatorParam(
                                    indicator.id,
                                    param.key,
                                    Number(event.target.value),
                                  )
                                }
                                data-testid={`custom-indicator-param-${indicator.id}-${param.key}`}
                              />
                            </div>
                          );
                        }

                        if (param.type === "select" && param.options) {
                          return (
                            <div key={param.key} className="space-y-2">
                              <Label>{param.label}</Label>
                              <Select
                                value={String(currentValue)}
                                onValueChange={(value) =>
                                  onUpdateIndicatorParam(indicator.id, param.key, value)
                                }
                                disabled={disabled}
                              >
                                <SelectTrigger
                                  data-testid={`custom-indicator-param-${indicator.id}-${param.key}`}
                                >
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {param.options.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                      {option.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          );
                        }

                        return (
                          <div key={param.key} className="flex items-center gap-3 pt-6">
                            <Checkbox
                              id={`${indicator.id}-${param.key}`}
                              checked={Boolean(currentValue)}
                              onCheckedChange={(checked) =>
                                onUpdateIndicatorParam(indicator.id, param.key, checked === true)
                              }
                              disabled={disabled}
                              data-testid={`custom-indicator-param-${indicator.id}-${param.key}`}
                            />
                            <Label htmlFor={`${indicator.id}-${param.key}`}>{param.label}</Label>
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex flex-wrap gap-1">
                      {catalogItem.outputs.map((output) => (
                        <Badge key={output} variant="secondary">
                          Output: {output}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}