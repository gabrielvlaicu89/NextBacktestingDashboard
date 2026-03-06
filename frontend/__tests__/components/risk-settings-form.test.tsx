import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RiskSettingsForm } from "@/components/strategy-builder/risk-settings-form";
import { DEFAULT_RISK_SETTINGS } from "@/lib/types";

describe("RiskSettingsForm", () => {
  const onChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders data-testid risk-settings-form", () => {
    render(<RiskSettingsForm value={DEFAULT_RISK_SETTINGS} onChange={onChange} />);
    expect(screen.getByTestId("risk-settings-form")).toBeInTheDocument();
  });

  it("renders Starting Capital label and input", () => {
    render(<RiskSettingsForm value={DEFAULT_RISK_SETTINGS} onChange={onChange} />);
    expect(screen.getByLabelText(/Starting Capital/)).toBeInTheDocument();
    expect(screen.getByTestId("risk-starting-capital")).toHaveValue(10000);
  });

  it("renders Position Sizing select", () => {
    render(<RiskSettingsForm value={DEFAULT_RISK_SETTINGS} onChange={onChange} />);
    expect(screen.getByLabelText("Position Sizing")).toBeInTheDocument();
  });

  it("renders Position Size input with % label for PERCENT_PORTFOLIO mode", () => {
    render(<RiskSettingsForm value={DEFAULT_RISK_SETTINGS} onChange={onChange} />);
    expect(screen.getByLabelText(/Position Size.*%/)).toBeInTheDocument();
  });

  it("renders Position Size input with $ label for FIXED_DOLLAR mode", () => {
    render(
      <RiskSettingsForm
        value={{ ...DEFAULT_RISK_SETTINGS, position_sizing_mode: "FIXED_DOLLAR" }}
        onChange={onChange}
      />
    );
    expect(screen.getByLabelText(/Position Size.*\$/)).toBeInTheDocument();
  });

  it("renders Stop Loss input", () => {
    render(<RiskSettingsForm value={DEFAULT_RISK_SETTINGS} onChange={onChange} />);
    expect(screen.getByLabelText(/Stop Loss/)).toBeInTheDocument();
    // Default is null, so input should be empty
    expect(screen.getByTestId("risk-stop-loss")).toHaveValue(null);
  });

  it("renders Take Profit input", () => {
    render(<RiskSettingsForm value={DEFAULT_RISK_SETTINGS} onChange={onChange} />);
    expect(screen.getByLabelText(/Take Profit/)).toBeInTheDocument();
    expect(screen.getByTestId("risk-take-profit")).toHaveValue(null);
  });

  it("calls onChange with starting_capital when capital input changes", () => {
    render(<RiskSettingsForm value={DEFAULT_RISK_SETTINGS} onChange={onChange} />);
    fireEvent.change(screen.getByTestId("risk-starting-capital"), {
      target: { value: "50000" },
    });
    expect(onChange).toHaveBeenCalledWith({ starting_capital: 50000 });
  });

  it("calls onChange with position_size when position size changes", () => {
    render(<RiskSettingsForm value={DEFAULT_RISK_SETTINGS} onChange={onChange} />);
    fireEvent.change(screen.getByTestId("risk-position-size"), {
      target: { value: "50" },
    });
    expect(onChange).toHaveBeenCalledWith({ position_size: 50 });
  });

  it("calls onChange with stop_loss_pct=null when cleared", () => {
    render(
      <RiskSettingsForm
        value={{ ...DEFAULT_RISK_SETTINGS, stop_loss_pct: 5 }}
        onChange={onChange}
      />
    );
    fireEvent.change(screen.getByTestId("risk-stop-loss"), {
      target: { value: "" },
    });
    expect(onChange).toHaveBeenCalledWith({ stop_loss_pct: null });
  });

  it("calls onChange with take_profit_pct=null when cleared", () => {
    render(
      <RiskSettingsForm
        value={{ ...DEFAULT_RISK_SETTINGS, take_profit_pct: 10 }}
        onChange={onChange}
      />
    );
    fireEvent.change(screen.getByTestId("risk-take-profit"), {
      target: { value: "" },
    });
    expect(onChange).toHaveBeenCalledWith({ take_profit_pct: null });
  });

  it("disables all inputs when disabled=true", () => {
    render(
      <RiskSettingsForm
        value={DEFAULT_RISK_SETTINGS}
        onChange={onChange}
        disabled
      />
    );
    expect(screen.getByTestId("risk-starting-capital")).toBeDisabled();
    expect(screen.getByTestId("risk-position-size")).toBeDisabled();
    expect(screen.getByTestId("risk-stop-loss")).toBeDisabled();
    expect(screen.getByTestId("risk-take-profit")).toBeDisabled();
  });

  it("shows stop loss value when set", () => {
    render(
      <RiskSettingsForm
        value={{ ...DEFAULT_RISK_SETTINGS, stop_loss_pct: 5 }}
        onChange={onChange}
      />
    );
    expect(screen.getByTestId("risk-stop-loss")).toHaveValue(5);
  });
});
