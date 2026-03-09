import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CustomStrategyRuleBuilder } from "@/components/custom-strategy/custom-strategy-rule-builder";
import type { CustomStrategyValidationIssue, RuleGroup } from "@/lib/types";

function createEmptyGroup(): RuleGroup {
  return {
    type: "group",
    operator: "AND",
    conditions: [],
  };
}

function createConditionIssue(
  overrides: Partial<CustomStrategyValidationIssue> = {},
): CustomStrategyValidationIssue {
  return {
    path: ["longEntry", "conditions", 0, "left", "indicatorId"],
    message: "Select an indicator for this operand.",
    section: "longEntry",
    conditionIndex: 0,
    ...overrides,
  };
}

describe("CustomStrategyRuleBuilder", () => {
  it("renders all four rule groups", () => {
    render(
      <CustomStrategyRuleBuilder
        indicators={[]}
        groups={{
          longEntry: createEmptyGroup(),
          longExit: createEmptyGroup(),
          shortEntry: createEmptyGroup(),
          shortExit: createEmptyGroup(),
        }}
        validationIssues={[]}
        onAddCondition={vi.fn()}
        onAddGroup={vi.fn()}
        onRemoveNode={vi.fn()}
        onChangeComparator={vi.fn()}
        onChangeOperator={vi.fn()}
        onChangeOperand={vi.fn()}
      />,
    );

    expect(screen.getByTestId("rule-group-longEntry")).toBeInTheDocument();
    expect(screen.getByTestId("rule-group-longExit")).toBeInTheDocument();
    expect(screen.getByTestId("rule-group-shortEntry")).toBeInTheDocument();
    expect(screen.getByTestId("rule-group-shortExit")).toBeInTheDocument();
  });

  it("calls onAddCondition for the selected rule section", async () => {
    const user = userEvent.setup();
    const onAddCondition = vi.fn();

    render(
      <CustomStrategyRuleBuilder
        indicators={[]}
        groups={{
          longEntry: createEmptyGroup(),
          longExit: createEmptyGroup(),
          shortEntry: createEmptyGroup(),
          shortExit: createEmptyGroup(),
        }}
        validationIssues={[]}
        onAddCondition={onAddCondition}
        onAddGroup={vi.fn()}
        onRemoveNode={vi.fn()}
        onChangeComparator={vi.fn()}
        onChangeOperator={vi.fn()}
        onChangeOperand={vi.fn()}
      />,
    );

    await user.click(screen.getByTestId("add-rule-condition-longEntry"));

    expect(onAddCondition).toHaveBeenCalledWith("longEntry", []);
  });

  it("renders existing conditions and lets users remove them", async () => {
    const user = userEvent.setup();
    const onRemoveNode = vi.fn();

    render(
      <CustomStrategyRuleBuilder
        indicators={[]}
        groups={{
          longEntry: {
            type: "group",
            operator: "AND",
            conditions: [
              {
                type: "condition",
                left: { kind: "price", field: "CLOSE" },
                comparator: ">",
                right: { kind: "constant", value: 0 },
              },
            ],
          },
          longExit: createEmptyGroup(),
          shortEntry: createEmptyGroup(),
          shortExit: createEmptyGroup(),
        }}
        validationIssues={[]}
        onAddCondition={vi.fn()}
        onAddGroup={vi.fn()}
        onRemoveNode={onRemoveNode}
        onChangeComparator={vi.fn()}
        onChangeOperator={vi.fn()}
        onChangeOperand={vi.fn()}
      />,
    );

    expect(screen.getByTestId("rule-condition-longEntry-0")).toBeInTheDocument();
    await user.click(screen.getByTestId("remove-rule-condition-longEntry-0"));

    expect(onRemoveNode).toHaveBeenCalledWith("longEntry", [0]);
  });

  it("renders nested subgroups and lets users add conditions inside them", async () => {
    const user = userEvent.setup();
    const onAddCondition = vi.fn();

    render(
      <CustomStrategyRuleBuilder
        indicators={[]}
        groups={{
          longEntry: {
            type: "group",
            operator: "AND",
            conditions: [
              {
                type: "group",
                operator: "OR",
                conditions: [],
              },
            ],
          },
          longExit: createEmptyGroup(),
          shortEntry: createEmptyGroup(),
          shortExit: createEmptyGroup(),
        }}
        validationIssues={[]}
        onAddCondition={onAddCondition}
        onAddGroup={vi.fn()}
        onRemoveNode={vi.fn()}
        onChangeComparator={vi.fn()}
        onChangeOperator={vi.fn()}
        onChangeOperand={vi.fn()}
      />,
    );

    expect(screen.getByTestId("rule-subgroup-longEntry-0")).toBeInTheDocument();

    await user.click(screen.getByTestId("add-rule-condition-longEntry-0"));

    expect(onAddCondition).toHaveBeenCalledWith("longEntry", [0]);
  });

  it("lets users remove nested groups", async () => {
    const user = userEvent.setup();
    const onRemoveNode = vi.fn();

    render(
      <CustomStrategyRuleBuilder
        indicators={[]}
        groups={{
          longEntry: {
            type: "group",
            operator: "AND",
            conditions: [
              {
                type: "group",
                operator: "OR",
                conditions: [],
              },
            ],
          },
          longExit: createEmptyGroup(),
          shortEntry: createEmptyGroup(),
          shortExit: createEmptyGroup(),
        }}
        validationIssues={[]}
        onAddCondition={vi.fn()}
        onAddGroup={vi.fn()}
        onRemoveNode={onRemoveNode}
        onChangeComparator={vi.fn()}
        onChangeOperator={vi.fn()}
        onChangeOperand={vi.fn()}
      />,
    );

    await user.click(screen.getByTestId("remove-rule-group-longEntry-0"));

    expect(onRemoveNode).toHaveBeenCalledWith("longEntry", [0]);
  });

  it("renders validation errors for empty nested groups", () => {
    render(
      <CustomStrategyRuleBuilder
        indicators={[]}
        groups={{
          longEntry: {
            type: "group",
            operator: "AND",
            conditions: [
              {
                type: "group",
                operator: "OR",
                conditions: [],
              },
            ],
          },
          longExit: createEmptyGroup(),
          shortEntry: createEmptyGroup(),
          shortExit: createEmptyGroup(),
        }}
        validationIssues={[
          {
            path: ["longEntry", "conditions", 0, "conditions"],
            message: "Add at least one condition or remove this empty group.",
            section: "longEntry",
          },
        ]}
        onAddCondition={vi.fn()}
        onAddGroup={vi.fn()}
        onRemoveNode={vi.fn()}
        onChangeComparator={vi.fn()}
        onChangeOperator={vi.fn()}
        onChangeOperand={vi.fn()}
      />,
    );

    expect(screen.getByTestId("rule-group-errors-longEntry-0")).toHaveTextContent(
      "Add at least one condition or remove this empty group.",
    );
  });

  it("renders inline validation messages for invalid conditions", () => {
    render(
      <CustomStrategyRuleBuilder
        indicators={[]}
        groups={{
          longEntry: {
            type: "group",
            operator: "AND",
            conditions: [
              {
                type: "condition",
                left: { kind: "indicator", indicatorId: "" },
                comparator: ">",
                right: { kind: "constant", value: 0 },
              },
            ],
          },
          longExit: createEmptyGroup(),
          shortEntry: createEmptyGroup(),
          shortExit: createEmptyGroup(),
        }}
        validationIssues={[createConditionIssue()]}
        onAddCondition={vi.fn()}
        onAddGroup={vi.fn()}
        onRemoveNode={vi.fn()}
        onChangeComparator={vi.fn()}
        onChangeOperator={vi.fn()}
        onChangeOperand={vi.fn()}
      />,
    );

    expect(screen.getByTestId("rule-condition-errors-longEntry-0")).toHaveTextContent(
      "Left operand: Select an indicator for this operand.",
    );
  });
});