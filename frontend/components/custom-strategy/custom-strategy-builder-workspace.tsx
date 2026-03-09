"use client";

import { useEffect, useState, useTransition } from "react";
import { PencilLine, Plus, Save, Trash2 } from "lucide-react";
import type { CustomStrategyValidationIssue } from "@/lib/types";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  addCustomIndicator,
  addCustomRuleCondition,
  addCustomRuleGroup,
  createEmptyCustomStrategyDraft,
  removeCustomIndicator,
  removeCustomRuleNode,
  setBuilderMode,
  setCustomStrategyDraft,
  updateCustomIndicatorLabel,
  updateCustomIndicatorParam,
  updateCustomRuleConditionComparator,
  updateCustomRuleConditionOperand,
  updateCustomRuleGroupOperator,
  updateCustomStrategyMeta,
} from "@/store/slices/strategyBuilderSlice";
import {
  createCustomStrategyDefinition,
  deleteCustomStrategyDefinition,
  updateCustomStrategyDefinition,
} from "@/lib/actions/custom-strategy-definitions";
import {
  createCustomIndicatorNode,
  getCustomIndicatorCatalogItem,
} from "@/lib/custom-indicator-catalog";
import type { CustomStrategyDefinitionRecord } from "@/lib/types";
import { validateCustomStrategyBuilderDraft } from "@/lib/validations";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CustomStrategyIndicatorLibrary } from "@/components/custom-strategy/custom-strategy-indicator-library";
import { CustomStrategyRuleBuilder } from "@/components/custom-strategy/custom-strategy-rule-builder";

interface CustomStrategyBuilderWorkspaceProps {
  initialDefinitions: CustomStrategyDefinitionRecord[];
  initialDefinition: CustomStrategyDefinitionRecord | null;
}

function sortDefinitions(
  definitions: CustomStrategyDefinitionRecord[],
): CustomStrategyDefinitionRecord[] {
  return [...definitions].sort(
    (left, right) =>
      new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
  );
}

function formatValidationIssue(issue: CustomStrategyValidationIssue): string {
  if (issue.section) {
    const sectionLabelMap: Record<
      "longEntry" | "longExit" | "shortEntry" | "shortExit",
      string
    > = {
      longEntry: "Long entry",
      longExit: "Long exit",
      shortEntry: "Short entry",
      shortExit: "Short exit",
    };
    const sectionLabel = issue.section ? sectionLabelMap[issue.section] : "Rule";
    const numericPath = issue.path.filter(
      (segment): segment is number => typeof segment === "number",
    );

    if (issue.conditionIndex !== undefined && numericPath.length > 0) {
      return `${sectionLabel} condition ${numericPath
        .map((segment) => segment + 1)
        .join(".")}: ${issue.message}`;
    }

    if (numericPath.length > 0) {
      return `${sectionLabel} group ${numericPath
        .map((segment) => segment + 1)
        .join(".")}: ${issue.message}`;
    }

    return `${sectionLabel}: ${issue.message}`;
  }

  if (issue.path[0] === "name") {
    return `Strategy name: ${issue.message}`;
  }

  if (issue.path[0] === "description") {
    return `Description: ${issue.message}`;
  }

  if (issue.path[0] === "indicators") {
    return `Indicators: ${issue.message}`;
  }

  return issue.message;
}

export function CustomStrategyBuilderWorkspace({
  initialDefinitions,
  initialDefinition,
}: CustomStrategyBuilderWorkspaceProps) {
  const dispatch = useAppDispatch();
  const customStrategy = useAppSelector(
    (state) => state.strategyBuilder.customStrategy,
  );
  const [definitions, setDefinitions] = useState(
    sortDefinitions(initialDefinitions),
  );
  const [selectedId, setSelectedId] = useState<string | null>(
    initialDefinition?.id ?? null,
  );
  const [selectedTags, setSelectedTags] = useState<string[]>(
    initialDefinition?.tags ?? [],
  );
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const validationIssues = validateCustomStrategyBuilderDraft(customStrategy);

  useEffect(() => {
    dispatch(setBuilderMode("CUSTOM"));
    if (initialDefinition) {
      dispatch(setCustomStrategyDraft(initialDefinition.definition));
      return;
    }

    dispatch(setCustomStrategyDraft(createEmptyCustomStrategyDraft()));
  }, [dispatch, initialDefinition]);

  const handleNewDraft = () => {
    dispatch(setBuilderMode("CUSTOM"));
    dispatch(setCustomStrategyDraft(createEmptyCustomStrategyDraft()));
    setSelectedId(null);
    setSelectedTags([]);
    setStatusMessage(null);
    setErrorMessage(null);
  };

  const handleSelectDefinition = (definition: CustomStrategyDefinitionRecord) => {
    dispatch(setBuilderMode("CUSTOM"));
    dispatch(setCustomStrategyDraft(definition.definition));
    setSelectedId(definition.id);
    setSelectedTags(definition.tags);
    setStatusMessage(null);
    setErrorMessage(null);
  };

  const handleSave = () => {
    if (validationIssues.length > 0) {
      setStatusMessage(null);
      setErrorMessage("Resolve the validation issues before saving this draft.");
      return;
    }

    startTransition(async () => {
      setStatusMessage(null);
      setErrorMessage(null);

      try {
        const payload = {
          definition: customStrategy,
          tags: selectedTags,
        };
        const saved = selectedId
          ? await updateCustomStrategyDefinition(selectedId, payload)
          : await createCustomStrategyDefinition(payload);

        setDefinitions((current) => {
          const next = current.filter((definition) => definition.id !== saved.id);
          next.unshift(saved);
          return sortDefinitions(next);
        });
        setSelectedId(saved.id);
        setSelectedTags(saved.tags);
        dispatch(setCustomStrategyDraft(saved.definition));
        setStatusMessage(
          selectedId
            ? "Custom strategy draft updated successfully."
            : "Custom strategy draft saved successfully.",
        );
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Failed to save custom strategy.",
        );
      }
    });
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
      setStatusMessage(null);
      setErrorMessage(null);

      try {
        await deleteCustomStrategyDefinition(id);
        setDefinitions((current) =>
          current.filter((definition) => definition.id !== id),
        );

        if (selectedId === id) {
          dispatch(setCustomStrategyDraft(createEmptyCustomStrategyDraft()));
          setSelectedId(null);
          setSelectedTags([]);
        }

        setStatusMessage("Custom strategy draft deleted successfully.");
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Failed to delete custom strategy.",
        );
      }
    });
  };

  const handleAddIndicator = (indicatorId: string) => {
    const catalogItem = getCustomIndicatorCatalogItem(indicatorId);

    if (!catalogItem) {
      setErrorMessage(`Unknown indicator '${indicatorId}'.`);
      return;
    }

    dispatch(
      addCustomIndicator(
        createCustomIndicatorNode(catalogItem, customStrategy.indicators),
      ),
    );
    setStatusMessage(null);
    setErrorMessage(null);
  };

  return (
    <div className="space-y-6" data-testid="custom-strategy-builder-workspace">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Build Custom Stratergy
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Save and manage custom strategy drafts while the indicator and rule
            editors are being built out.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={handleNewDraft}
          disabled={isPending}
          data-testid="new-custom-draft-button"
        >
          <Plus className="h-4 w-4" />
          New Draft
        </Button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <Card>
          <CardHeader>
            <CardTitle>
              {selectedId ? "Edit Custom Draft" : "Create Custom Draft"}
            </CardTitle>
            <CardDescription>
              This page now supports draft metadata, indicator configuration,
              rule editing, and builder-side validation feedback.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="custom-strategy-name">Strategy Name</Label>
              <Input
                id="custom-strategy-name"
                value={customStrategy.name}
                onChange={(event) =>
                  dispatch(
                    updateCustomStrategyMeta({
                      name: event.target.value,
                      description: customStrategy.description,
                    }),
                  )
                }
                placeholder="My Custom Strategy"
                data-testid="custom-strategy-name-input"
                disabled={isPending}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="custom-strategy-description">Description</Label>
              <textarea
                id="custom-strategy-description"
                className="min-h-32 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={customStrategy.description}
                onChange={(event) =>
                  dispatch(
                    updateCustomStrategyMeta({
                      name: customStrategy.name,
                      description: event.target.value,
                    }),
                  )
                }
                placeholder="Describe what the strategy is intended to do."
                data-testid="custom-strategy-description-input"
                disabled={isPending}
              />
            </div>

            <CustomStrategyIndicatorLibrary
              indicators={customStrategy.indicators}
              onAddIndicator={handleAddIndicator}
              onRemoveIndicator={(indicatorId) =>
                dispatch(removeCustomIndicator(indicatorId))
              }
              onUpdateIndicatorLabel={(indicatorId, label) =>
                dispatch(updateCustomIndicatorLabel({ id: indicatorId, label }))
              }
              onUpdateIndicatorParam={(indicatorId, key, value) =>
                dispatch(updateCustomIndicatorParam({ id: indicatorId, key, value }))
              }
              disabled={isPending}
            />

            <CustomStrategyRuleBuilder
              indicators={customStrategy.indicators}
              groups={{
                longEntry: customStrategy.longEntry,
                longExit: customStrategy.longExit,
                shortEntry: customStrategy.shortEntry,
                shortExit: customStrategy.shortExit,
              }}
              validationIssues={validationIssues}
              onAddCondition={(section, path) =>
                dispatch(addCustomRuleCondition({ section, path }))
              }
              onAddGroup={(section, path) =>
                dispatch(addCustomRuleGroup({ section, path }))
              }
              onRemoveNode={(section, path) =>
                dispatch(removeCustomRuleNode({ section, path }))
              }
              onChangeComparator={(section, path, comparator) =>
                dispatch(
                  updateCustomRuleConditionComparator({
                    section,
                    path,
                    comparator,
                  }),
                )
              }
              onChangeOperator={(section, path, operator) =>
                dispatch(updateCustomRuleGroupOperator({ section, path, operator }))
              }
              onChangeOperand={(section, path, side, operand) =>
                dispatch(
                  updateCustomRuleConditionOperand({
                    section,
                    path,
                    side,
                    operand,
                  }),
                )
              }
              disabled={isPending}
            />

            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              Top-level rule sections can stay empty while drafting. Once you
              add a nested group, it must contain at least one condition before
              the draft can be saved.
            </div>

            {validationIssues.length > 0 && (
              <div
                className="rounded-md border border-amber-500/50 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200"
                data-testid="custom-builder-validation-summary"
              >
                <p className="font-medium">Resolve these validation issues before saving:</p>
                <ul className="mt-2 list-disc pl-5">
                  {validationIssues.map((issue, index) => (
                    <li
                      key={`${issue.path.join(".")}-${index}`}
                      data-testid={`custom-builder-validation-issue-${index}`}
                    >
                      {formatValidationIssue(issue)}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {errorMessage && (
              <div
                className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive"
                data-testid="custom-builder-error"
              >
                {errorMessage}
              </div>
            )}

            {statusMessage && (
              <div
                className="rounded-md border border-green-600/30 bg-green-600/10 p-3 text-sm text-green-700 dark:text-green-300"
                data-testid="custom-builder-status"
              >
                {statusMessage}
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Button
              onClick={handleSave}
              disabled={isPending}
              data-testid="save-custom-strategy-button"
            >
              <Save className="h-4 w-4" />
              {selectedId ? "Update Draft" : "Save Draft"}
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Saved Drafts</CardTitle>
            <CardDescription>
              Select a saved custom strategy draft to continue editing it.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {definitions.length === 0 ? (
              <p className="text-sm text-muted-foreground" data-testid="custom-draft-empty-state">
                No custom drafts saved yet.
              </p>
            ) : (
              definitions.map((definition) => {
                const isSelected = selectedId === definition.id;
                return (
                  <div
                    key={definition.id}
                    className={`rounded-lg border p-4 ${
                      isSelected ? "border-primary bg-primary/5" : "border-border"
                    }`}
                    data-testid={`custom-definition-row-${definition.id}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{definition.name}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {definition.description || "No description yet."}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSelectDefinition(definition)}
                          disabled={isPending}
                          data-testid={`edit-custom-definition-${definition.id}`}
                        >
                          <PencilLine className="h-4 w-4" />
                          Edit
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(definition.id)}
                          disabled={isPending}
                          data-testid={`delete-custom-definition-${definition.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </Button>
                      </div>
                    </div>

                    {definition.tags.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1">
                        {definition.tags.map((tag) => (
                          <Badge key={tag} variant="secondary">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}