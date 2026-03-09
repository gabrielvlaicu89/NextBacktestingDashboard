"use client";

import type {
  ComparisonOperator,
  ConstantOperand,
  CustomRuleSection,
  CustomStrategyValidationIssue,
  IndicatorOutputKey,
  IndicatorNode,
  IndicatorOperand,
  PriceField,
  PriceOperand,
  RuleGroup,
  RuleNode,
  RuleNodePath,
  RuleOperand,
} from "@/lib/types";
import { getCustomIndicatorCatalogItem } from "@/lib/custom-indicator-catalog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const RULE_SECTION_META: Array<{
  key: CustomRuleSection;
  title: string;
  description: string;
}> = [
  {
    key: "longEntry",
    title: "Long Entry Rules",
    description: "Conditions that must pass before opening a long position.",
  },
  {
    key: "longExit",
    title: "Long Exit Rules",
    description: "Conditions that close an open long position.",
  },
  {
    key: "shortEntry",
    title: "Short Entry Rules",
    description: "Conditions that must pass before opening a short position.",
  },
  {
    key: "shortExit",
    title: "Short Exit Rules",
    description: "Conditions that close an open short position.",
  },
];

const OPERAND_KIND_OPTIONS = ["price", "indicator", "constant"] as const;
const PRICE_FIELDS: PriceField[] = ["OPEN", "HIGH", "LOW", "CLOSE", "VOLUME"];
const COMPARATORS: ComparisonOperator[] = [
  ">",
  ">=",
  "<",
  "<=",
  "==",
  "crosses_above",
  "crosses_below",
];

interface CustomStrategyRuleBuilderProps {
  indicators: IndicatorNode[];
  groups: Record<CustomRuleSection, RuleGroup>;
  validationIssues?: CustomStrategyValidationIssue[];
  onAddCondition: (section: CustomRuleSection, path: RuleNodePath) => void;
  onAddGroup: (section: CustomRuleSection, path: RuleNodePath) => void;
  onRemoveNode: (section: CustomRuleSection, path: RuleNodePath) => void;
  onChangeComparator: (
    section: CustomRuleSection,
    path: RuleNodePath,
    comparator: ComparisonOperator,
  ) => void;
  onChangeOperator: (
    section: CustomRuleSection,
    path: RuleNodePath,
    operator: RuleGroup["operator"],
  ) => void;
  onChangeOperand: (
    section: CustomRuleSection,
    path: RuleNodePath,
    side: "left" | "right",
    operand: RuleOperand,
  ) => void;
  disabled?: boolean;
}

function getIssueNodePath(issue: CustomStrategyValidationIssue): RuleNodePath {
  return issue.path.filter((segment): segment is number => typeof segment === "number");
}

function pathKey(path: RuleNodePath): string {
  return path.join("-");
}

function joinTestId(base: string, section: CustomRuleSection, path: RuleNodePath): string {
  return path.length === 0
    ? `${base}-${section}`
    : `${base}-${section}-${pathKey(path)}`;
}

function joinConditionTestId(
  base: string,
  section: CustomRuleSection,
  path: RuleNodePath,
): string {
  return `${base}-${section}-${pathKey(path)}`;
}

function describeGroupPath(path: RuleNodePath): string {
  return path.length === 0
    ? "Root Group"
    : `Nested Group ${path.map((segment) => segment + 1).join(".")}`;
}

function formatConditionIssue(issue: CustomStrategyValidationIssue): string {
  if (issue.path.includes("left") || issue.path.includes("right")) {
    const side = issue.path.includes("left") ? "Left" : "Right";
    return `${side} operand: ${issue.message}`;
  }

  return issue.message;
}

function createDefaultOperand(
  kind: (typeof OPERAND_KIND_OPTIONS)[number],
  indicators: IndicatorNode[],
): RuleOperand {
  if (kind === "indicator") {
    const firstIndicator = indicators[0];

    return {
      kind: "indicator",
      indicatorId: firstIndicator?.id ?? "",
      output: firstIndicator
        ? getCustomIndicatorCatalogItem(firstIndicator.indicatorId)?.outputs[0]
        : undefined,
    } satisfies IndicatorOperand;
  }

  if (kind === "constant") {
    return {
      kind: "constant",
      value: 0,
    } satisfies ConstantOperand;
  }

  return {
    kind: "price",
    field: "CLOSE",
  } satisfies PriceOperand;
}

function getIndicatorOutputs(indicator?: IndicatorNode): IndicatorOutputKey[] {
  if (!indicator) {
    return ["value"];
  }

  return getCustomIndicatorCatalogItem(indicator.indicatorId)?.outputs ?? ["value"];
}

function labelForIndicator(indicator: IndicatorNode): string {
  return `${indicator.label} (${indicator.id})`;
}

function OperandEditor({
  operand,
  indicators,
  onChange,
  testIdPrefix,
  disabled = false,
}: {
  operand: RuleOperand;
  indicators: IndicatorNode[];
  onChange: (operand: RuleOperand) => void;
  testIdPrefix: string;
  disabled?: boolean;
}) {
  const currentIndicator =
    operand.kind === "indicator"
      ? indicators.find((indicator) => indicator.id === operand.indicatorId)
      : undefined;
  const indicatorOutputs = getIndicatorOutputs(currentIndicator);

  return (
    <div className="grid gap-3 md:grid-cols-[140px_minmax(0,1fr)_minmax(0,1fr)]">
      <div className="space-y-2">
        <Label>Operand</Label>
        <Select
          value={operand.kind}
          onValueChange={(value: (typeof OPERAND_KIND_OPTIONS)[number]) =>
            onChange(createDefaultOperand(value, indicators))
          }
          disabled={disabled}
        >
          <SelectTrigger data-testid={`${testIdPrefix}-kind`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {OPERAND_KIND_OPTIONS.map((kind) => (
              <SelectItem key={kind} value={kind}>
                {kind === "price"
                  ? "Price"
                  : kind === "indicator"
                    ? "Indicator"
                    : "Constant"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {operand.kind === "price" && (
        <div className="space-y-2 md:col-span-2">
          <Label>Field</Label>
          <Select
            value={operand.field}
            onValueChange={(value: PriceField) =>
              onChange({ kind: "price", field: value })
            }
            disabled={disabled}
          >
            <SelectTrigger data-testid={`${testIdPrefix}-price-field`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRICE_FIELDS.map((field) => (
                <SelectItem key={field} value={field}>
                  {field}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {operand.kind === "indicator" && (
        <>
          <div className="space-y-2">
            <Label>Indicator</Label>
            <Select
              value={operand.indicatorId}
              onValueChange={(value) => {
                const nextIndicator = indicators.find((indicator) => indicator.id === value);
                const nextOutputs = getIndicatorOutputs(nextIndicator);

                onChange({
                  kind: "indicator",
                  indicatorId: value,
                  output: nextOutputs[0],
                });
              }}
              disabled={disabled || indicators.length === 0}
            >
              <SelectTrigger data-testid={`${testIdPrefix}-indicator-id`}>
                <SelectValue placeholder="Select indicator" />
              </SelectTrigger>
              <SelectContent>
                {indicators.map((indicator) => (
                  <SelectItem key={indicator.id} value={indicator.id}>
                    {labelForIndicator(indicator)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Output</Label>
            <Select
              value={operand.output ?? indicatorOutputs[0] ?? "value"}
              onValueChange={(value) =>
                onChange({
                  kind: "indicator",
                  indicatorId: operand.indicatorId,
                  output: value as IndicatorOperand["output"],
                })
              }
              disabled={disabled || indicators.length === 0}
            >
              <SelectTrigger data-testid={`${testIdPrefix}-indicator-output`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {indicatorOutputs.map((output) => (
                  <SelectItem key={output} value={output}>
                    {output}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </>
      )}

      {operand.kind === "constant" && (
        <div className="space-y-2 md:col-span-2">
          <Label>Value</Label>
          <Input
            type="number"
            value={String(operand.value)}
            onChange={(event) =>
              onChange({ kind: "constant", value: Number(event.target.value) })
            }
            data-testid={`${testIdPrefix}-constant-value`}
            disabled={disabled}
          />
        </div>
      )}
    </div>
  );
}

export function CustomStrategyRuleBuilder({
  indicators,
  groups,
  validationIssues = [],
  onAddCondition,
  onAddGroup,
  onRemoveNode,
  onChangeComparator,
  onChangeOperator,
  onChangeOperand,
  disabled = false,
}: CustomStrategyRuleBuilderProps) {
  const renderNode = (
    section: CustomRuleSection,
    node: RuleNode,
    path: RuleNodePath,
  ) => {
    if (node.type === "condition") {
      const conditionIssues = validationIssues.filter(
        (issue) =>
          issue.section === section &&
          pathKey(getIssueNodePath(issue)) === pathKey(path),
      );

      return (
        <div
          key={`${section}-${pathKey(path)}`}
          className="rounded-lg border p-4"
          data-testid={joinConditionTestId("rule-condition", section, path)}
        >
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="text-sm font-medium">Condition {path[path.length - 1] + 1}</p>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => onRemoveNode(section, path)}
              disabled={disabled}
              data-testid={joinConditionTestId("remove-rule-condition", section, path)}
            >
              Remove
            </Button>
          </div>

          <div className="space-y-4">
            {conditionIssues.length > 0 && (
              <div
                className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive"
                data-testid={joinConditionTestId("rule-condition-errors", section, path)}
              >
                {conditionIssues.map((issue, issueIndex) => (
                  <p
                    key={`${issue.path.join(".")}-${issueIndex}`}
                    data-testid={`${joinConditionTestId("rule-condition-error", section, path)}-${issueIndex}`}
                  >
                    {formatConditionIssue(issue)}
                  </p>
                ))}
              </div>
            )}

            <OperandEditor
              operand={node.left}
              indicators={indicators}
              onChange={(operand) => onChangeOperand(section, path, "left", operand)}
              testIdPrefix={`${joinConditionTestId("rule-condition", section, path)}-left`}
              disabled={disabled}
            />

            <div className="space-y-2">
              <Label>Comparator</Label>
              <Select
                value={node.comparator}
                onValueChange={(value: ComparisonOperator) =>
                  onChangeComparator(section, path, value)
                }
                disabled={disabled}
              >
                <SelectTrigger
                  data-testid={`${joinConditionTestId("rule-condition", section, path)}-comparator`}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COMPARATORS.map((comparator) => (
                    <SelectItem key={comparator} value={comparator}>
                      {comparator}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <OperandEditor
              operand={node.right}
              indicators={indicators}
              onChange={(operand) => onChangeOperand(section, path, "right", operand)}
              testIdPrefix={`${joinConditionTestId("rule-condition", section, path)}-right`}
              disabled={disabled}
            />
          </div>
        </div>
      );
    }

    const groupIssues = validationIssues.filter(
      (issue) =>
        issue.section === section && pathKey(getIssueNodePath(issue)) === pathKey(path),
    );
    const isRoot = path.length === 0;

    return (
      <div
        key={`${section}-${pathKey(path) || "root"}`}
        className={isRoot ? "space-y-4" : "space-y-4 rounded-lg border border-dashed p-4"}
        data-testid={
          isRoot
            ? `rule-group-content-${section}`
            : joinTestId("rule-subgroup", section, path)
        }
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            {!isRoot && <p className="text-sm font-medium">{describeGroupPath(path)}</p>}
            <Label>Group Operator</Label>
            <Select
              value={node.operator}
              onValueChange={(value: RuleGroup["operator"]) =>
                onChangeOperator(section, path, value)
              }
              disabled={disabled}
            >
              <SelectTrigger data-testid={joinTestId("rule-group-operator", section, path)}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="AND">AND</SelectItem>
                <SelectItem value="OR">OR</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onAddCondition(section, path)}
              disabled={disabled}
              data-testid={joinTestId("add-rule-condition", section, path)}
            >
              Add Condition
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => onAddGroup(section, path)}
              disabled={disabled}
              data-testid={joinTestId("add-rule-group", section, path)}
            >
              Add Group
            </Button>
            {!isRoot && (
              <Button
                type="button"
                variant="destructive"
                onClick={() => onRemoveNode(section, path)}
                disabled={disabled}
                data-testid={joinTestId("remove-rule-group", section, path)}
              >
                Remove Group
              </Button>
            )}
          </div>
        </div>

        {groupIssues.length > 0 && (
          <div
            className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive"
            data-testid={joinTestId("rule-group-errors", section, path)}
          >
            {groupIssues.map((issue, index) => (
              <p
                key={`${issue.path.join(".")}-${index}`}
                data-testid={`${joinTestId("rule-group-error", section, path)}-${index}`}
              >
                {issue.message}
              </p>
            ))}
          </div>
        )}

        {node.conditions.length === 0 ? (
          <div
            className="rounded-md border border-dashed p-4 text-sm text-muted-foreground"
            data-testid={joinTestId("empty-rule-group", section, path)}
          >
            No conditions yet. Add one to start defining this rule group.
          </div>
        ) : (
          <div className="space-y-4">
            {node.conditions.map((child, index) => renderNode(section, child, [...path, index]))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6" data-testid="custom-rule-builder">
      <div>
        <h2 className="text-base font-semibold">Rule Builder</h2>
        <p className="text-sm text-muted-foreground">
          Build nested condition groups for each trade lifecycle stage using AND
          and OR operators.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {RULE_SECTION_META.map((sectionMeta) => {
          const group = groups[sectionMeta.key];

          return (
            <Card key={sectionMeta.key} data-testid={`rule-group-${sectionMeta.key}`}>
              <CardHeader>
                <CardTitle className="text-base">{sectionMeta.title}</CardTitle>
                <CardDescription>{sectionMeta.description}</CardDescription>
              </CardHeader>
              <CardContent>{renderNode(sectionMeta.key, group, [])}</CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}