"""Pydantic schemas for request/response models."""

from __future__ import annotations

from datetime import date
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field, model_validator

# ── Enums ─────────────────────────────────────────────────────────────────────


class StrategyType(str, Enum):
    MEAN_REVERSION = "MEAN_REVERSION"
    MA_CROSSOVER = "MA_CROSSOVER"
    EARNINGS_DRIFT = "EARNINGS_DRIFT"
    PAIRS_TRADING = "PAIRS_TRADING"
    BUY_AND_HOLD = "BUY_AND_HOLD"


class MAType(str, Enum):
    SMA = "SMA"
    EMA = "EMA"


class PositionSizingMode(str, Enum):
    FIXED_DOLLAR = "FIXED_DOLLAR"
    PERCENT_PORTFOLIO = "PERCENT_PORTFOLIO"


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
