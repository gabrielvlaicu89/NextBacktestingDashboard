"""Pydantic schemas for request/response models."""

from __future__ import annotations

from datetime import date
from enum import Enum
from typing import Annotated, Any, Literal

from pydantic import BaseModel, Field, model_validator

# ── Enums ─────────────────────────────────────────────────────────────────────


class StrategyType(str, Enum):
    MEAN_REVERSION = "MEAN_REVERSION"
    MA_CROSSOVER = "MA_CROSSOVER"
    EARNINGS_DRIFT = "EARNINGS_DRIFT"
    PAIRS_TRADING = "PAIRS_TRADING"
    BUY_AND_HOLD = "BUY_AND_HOLD"
    CUSTOM = "CUSTOM"


class MAType(str, Enum):
    SMA = "SMA"
    EMA = "EMA"


class PositionSizingMode(str, Enum):
    FIXED_DOLLAR = "FIXED_DOLLAR"
    PERCENT_PORTFOLIO = "PERCENT_PORTFOLIO"


class RuleGroupOperator(str, Enum):
    AND = "AND"
    OR = "OR"


class ComparisonOperator(str, Enum):
    GREATER_THAN = ">"
    GREATER_THAN_OR_EQUAL = ">="
    LESS_THAN = "<"
    LESS_THAN_OR_EQUAL = "<="
    EQUAL = "=="
    CROSSES_ABOVE = "crosses_above"
    CROSSES_BELOW = "crosses_below"


class PriceField(str, Enum):
    OPEN = "OPEN"
    HIGH = "HIGH"
    LOW = "LOW"
    CLOSE = "CLOSE"
    VOLUME = "VOLUME"


class IndicatorOutputKey(str, Enum):
    VALUE = "value"
    UPPER = "upper"
    MIDDLE = "middle"
    LOWER = "lower"
    HISTOGRAM = "histogram"


# ── Sub-models ────────────────────────────────────────────────────────────────


class RiskSettings(BaseModel):
    starting_capital: float = Field(10_000, ge=100)
    position_sizing_mode: PositionSizingMode = PositionSizingMode.PERCENT_PORTFOLIO
    position_size: float = Field(100.0, gt=0)  # $ if FIXED_DOLLAR, % if PERCENT
    stop_loss_pct: float | None = Field(None, ge=0, le=100)
    take_profit_pct: float | None = Field(None, ge=0)


class MeanReversionParams(BaseModel):
    zscore_window: int = Field(20, ge=5)
    zscore_threshold: float = Field(2.0, gt=0)
    holding_period: int = Field(10, ge=1)


class MACrossoverParams(BaseModel):
    fast_period: int = Field(10, ge=2)
    slow_period: int = Field(50, ge=5)
    ma_type: MAType = MAType.EMA


class EarningsDriftParams(BaseModel):
    days_before: int = Field(2, ge=0)
    days_after: int = Field(5, ge=0)
    eps_surprise_threshold: float = Field(0.0)  # % — 0 = any positive surprise


class PairsTradingParams(BaseModel):
    ticker_b: str
    correlation_window: int = Field(60, ge=20)
    spread_threshold: float = Field(2.0, gt=0)


class IndicatorNode(BaseModel):
    id: str = Field(min_length=1, max_length=100)
    indicatorId: str = Field(min_length=1, max_length=100)
    label: str = Field(min_length=1, max_length=200)
    params: dict[str, Any] = Field(default_factory=dict)


class PriceOperand(BaseModel):
    kind: Literal["price"]
    field: PriceField


class IndicatorOperand(BaseModel):
    kind: Literal["indicator"]
    indicatorId: str = Field(min_length=1, max_length=100)
    output: IndicatorOutputKey = IndicatorOutputKey.VALUE


class ConstantOperand(BaseModel):
    kind: Literal["constant"]
    value: float


RuleOperand = Annotated[
    PriceOperand | IndicatorOperand | ConstantOperand,
    Field(discriminator="kind"),
]


class RuleCondition(BaseModel):
    type: Literal["condition"]
    left: RuleOperand
    comparator: ComparisonOperator
    right: RuleOperand

    @model_validator(mode="after")
    def validate_non_constant_comparison(self) -> "RuleCondition":
        if self.left.kind == "constant" and self.right.kind == "constant":
            raise ValueError("A rule condition cannot compare two constant values")
        return self


class RuleGroup(BaseModel):
    type: Literal["group"]
    operator: RuleGroupOperator = RuleGroupOperator.AND
    conditions: list[RuleNode] = Field(default_factory=list)


RuleNode = Annotated[RuleCondition | RuleGroup, Field(discriminator="type")]


class CustomStrategyDefinition(BaseModel):
    version: Literal[1]
    name: str = Field(min_length=1, max_length=200)
    description: str = Field(default="", max_length=1000)
    indicators: list[IndicatorNode] = Field(default_factory=list)
    longEntry: RuleGroup
    longExit: RuleGroup
    shortEntry: RuleGroup
    shortExit: RuleGroup

    @model_validator(mode="after")
    def validate_indicator_references(self) -> "CustomStrategyDefinition":
        indicator_ids = [indicator.id for indicator in self.indicators]
        unique_ids = set(indicator_ids)

        if len(unique_ids) != len(indicator_ids):
            raise ValueError("Indicator IDs must be unique within a custom strategy definition")

        referenced_ids: set[str] = set()

        def collect_references(node: RuleNode) -> None:
            if isinstance(node, RuleCondition):
                for operand in (node.left, node.right):
                    if isinstance(operand, IndicatorOperand):
                        referenced_ids.add(operand.indicatorId)
                return

            for child in node.conditions:
                collect_references(child)

        for group in (
            self.longEntry,
            self.longExit,
            self.shortEntry,
            self.shortExit,
        ):
            collect_references(group)

        missing_ids = sorted(referenced_ids - unique_ids)
        if missing_ids:
            raise ValueError(
                f"Rules reference unknown indicators: {', '.join(missing_ids)}"
            )

        return self


RuleGroup.model_rebuild()
CustomStrategyDefinition.model_rebuild()


# ── Backtest Request ──────────────────────────────────────────────────────────


class BacktestRequest(BaseModel):
    strategy_type: StrategyType
    ticker: str
    date_from: date
    date_to: date
    benchmark: str = "SPY"
    risk_settings: RiskSettings = Field(default_factory=RiskSettings)
    parameters: dict[str, Any] = Field(default_factory=dict)

    @model_validator(mode="after")
    def validate_date_range(self) -> "BacktestRequest":
        if self.date_to <= self.date_from:
            raise ValueError("date_to must be after date_from")
        if self.strategy_type == StrategyType.CUSTOM and "custom_definition" not in self.parameters:
            raise ValueError(
                "Custom backtests require a 'custom_definition' entry in parameters"
            )
        return self


# ── Trade ─────────────────────────────────────────────────────────────────────


class TradeResult(BaseModel):
    entry_date: str
    exit_date: str
    entry_price: float
    exit_price: float
    pnl: float
    pnl_pct: float
    holding_days: int
    exit_reason: str


# ── Metrics ───────────────────────────────────────────────────────────────────


class PerformanceMetrics(BaseModel):
    total_return_pct: float
    annualized_return_pct: float
    max_drawdown_pct: float
    sharpe_ratio: float
    sortino_ratio: float
    win_rate_pct: float
    profit_factor: float | None


# ── Backtest Response ─────────────────────────────────────────────────────────


class BacktestResponse(BaseModel):
    metrics: PerformanceMetrics
    equity_curve: list[dict]  # [{date, value, benchmark_value}, ...]
    drawdown_series: list[dict]  # [{date, drawdown_pct}, ...]
    monthly_returns: list[dict]  # [{year, month, return_pct}, ...]
    trades: list[TradeResult]


# ── Optimize Request ──────────────────────────────────────────────────────────


class ParamRange(BaseModel):
    min: float
    max: float
    step: float


class OptimizeRequest(BaseModel):
    strategy_type: StrategyType
    ticker: str
    date_from: date
    date_to: date
    benchmark: str = "SPY"
    risk_settings: RiskSettings = Field(default_factory=RiskSettings)
    fixed_parameters: dict[str, Any] = Field(default_factory=dict)
    param_ranges: dict[str, ParamRange]
    optimize_for: str = "sharpe_ratio"

    @model_validator(mode="after")
    def validate_date_range(self) -> "OptimizeRequest":
        if self.date_to <= self.date_from:
            raise ValueError("date_to must be after date_from")
        return self


# ── SSE Progress ─────────────────────────────────────────────────────────────


class ProgressEvent(BaseModel):
    type: str  # "progress" | "complete" | "error"
    percent: float | None = None
    message: str | None = None
    results: BacktestResponse | None = None


# ── Ticker ────────────────────────────────────────────────────────────────────


class TickerResult(BaseModel):
    symbol: str
    name: str
    exchange: str
    type: str
