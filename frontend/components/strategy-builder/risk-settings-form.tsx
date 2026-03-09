"use client";

/**
 * RiskSettingsForm — capital, position sizing, stop-loss, take-profit controls.
 */
import type { RiskSettings, PositionSizingMode } from "@/lib/types";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface RiskSettingsFormProps {
  value: RiskSettings;
  onChange: (partial: Partial<RiskSettings>) => void;
  disabled?: boolean;
}

export function RiskSettingsForm({
  value,
  onChange,
  disabled = false,
}: RiskSettingsFormProps) {
  return (
    <div className="space-y-4" data-testid="risk-settings-form">
      {/* Starting Capital + Position Sizing Mode */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="starting_capital">Starting Capital ($)</Label>
          <Input
            id="starting_capital"
            type="number"
            min={100}
            step={100}
            value={value.starting_capital}
            disabled={disabled}
            onChange={(e) =>
              onChange({ starting_capital: Number(e.target.value) || 0 })
            }
            data-testid="risk-starting-capital"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="position_sizing_mode">Position Sizing</Label>
          <Select
            value={value.position_sizing_mode}
            onValueChange={(val: string) =>
              onChange({ position_sizing_mode: val as PositionSizingMode })
            }
            disabled={disabled}
          >
            <SelectTrigger
              id="position_sizing_mode"
              data-testid="risk-position-sizing-mode"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PERCENT_PORTFOLIO">% of Portfolio</SelectItem>
              <SelectItem value="FIXED_DOLLAR">Fixed Dollar</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Position Size + Stop Loss + Take Profit */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="position_size">
            Position Size{" "}
            {value.position_sizing_mode === "PERCENT_PORTFOLIO" ? "(%)" : "($)"}
          </Label>
          <Input
            id="position_size"
            type="number"
            min={0}
            step={value.position_sizing_mode === "PERCENT_PORTFOLIO" ? 5 : 100}
            value={value.position_size}
            disabled={disabled}
            onChange={(e) =>
              onChange({ position_size: Number(e.target.value) || 0 })
            }
            data-testid="risk-position-size"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="stop_loss_pct">Stop Loss (%)</Label>
          <Input
            id="stop_loss_pct"
            type="number"
            min={0}
            max={100}
            step={0.5}
            placeholder="None"
            value={value.stop_loss_pct ?? ""}
            disabled={disabled}
            onChange={(e) =>
              onChange({
                stop_loss_pct:
                  e.target.value === "" ? null : Number(e.target.value),
              })
            }
            data-testid="risk-stop-loss"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="take_profit_pct">Take Profit (%)</Label>
          <Input
            id="take_profit_pct"
            type="number"
            min={0}
            step={0.5}
            placeholder="None"
            value={value.take_profit_pct ?? ""}
            disabled={disabled}
            onChange={(e) =>
              onChange({
                take_profit_pct:
                  e.target.value === "" ? null : Number(e.target.value),
              })
            }
            data-testid="risk-take-profit"
          />
        </div>
      </div>
    </div>
  );
}
