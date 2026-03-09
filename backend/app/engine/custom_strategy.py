"""Custom strategy execution using the saved rule DSL and indicator catalog."""

from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd

from app.engine.base import Strategy
from app.models.schemas import (
    ComparisonOperator,
    ConstantOperand,
    CustomStrategyDefinition,
    IndicatorOperand,
    IndicatorOutputKey,
    IndicatorNode,
    PriceField,
    PriceOperand,
    RuleCondition,
    RuleGroup,
    RuleNode,
)


PRICE_FIELD_MAP: dict[PriceField, str] = {
    PriceField.OPEN: "Open",
    PriceField.HIGH: "High",
    PriceField.LOW: "Low",
    PriceField.CLOSE: "Close",
    PriceField.VOLUME: "Volume",
}


def _compute_rsi(close: pd.Series, period: int) -> pd.Series:
    delta = close.diff()
    gains = delta.clip(lower=0)
    losses = -delta.clip(upper=0)
    average_gain = gains.rolling(period, min_periods=period).mean()
    average_loss = losses.rolling(period, min_periods=period).mean()
    relative_strength = average_gain / average_loss.replace(0, np.nan)
    return 100 - (100 / (1 + relative_strength))


def _compute_indicator_outputs(
    df: pd.DataFrame, indicator: IndicatorNode
) -> dict[IndicatorOutputKey, pd.Series]:
    close = df["Close"].astype(float)
    indicator_id = indicator.indicatorId.upper()
    params = indicator.params

    if indicator_id == "RSI":
        period = int(params.get("period", 14))
        return {IndicatorOutputKey.VALUE: _compute_rsi(close, period)}

    if indicator_id == "SMA":
        period = int(params.get("period", 20))
        return {IndicatorOutputKey.VALUE: close.rolling(period, min_periods=period).mean()}

    if indicator_id == "EMA":
        period = int(params.get("period", 20))
        return {IndicatorOutputKey.VALUE: close.ewm(span=period, adjust=False).mean()}

    if indicator_id == "BOLLINGER_BANDS":
        window = int(params.get("window", 20))
        std_dev = float(params.get("stdDev", 2))
        middle = close.rolling(window, min_periods=window).mean()
        spread = close.rolling(window, min_periods=window).std()
        return {
            IndicatorOutputKey.MIDDLE: middle,
            IndicatorOutputKey.UPPER: middle + spread * std_dev,
            IndicatorOutputKey.LOWER: middle - spread * std_dev,
        }

    if indicator_id == "MACD":
        fast_period = int(params.get("fastPeriod", 12))
        slow_period = int(params.get("slowPeriod", 26))
        signal_period = int(params.get("signalPeriod", 9))
        fast_ema = close.ewm(span=fast_period, adjust=False).mean()
        slow_ema = close.ewm(span=slow_period, adjust=False).mean()
        macd_line = fast_ema - slow_ema
        signal_line = macd_line.ewm(span=signal_period, adjust=False).mean()
        return {
            IndicatorOutputKey.VALUE: macd_line,
            IndicatorOutputKey.HISTOGRAM: macd_line - signal_line,
        }

    raise ValueError(f"Unsupported custom indicator '{indicator.indicatorId}'")


def _evaluate_comparator(
    left: pd.Series, comparator: ComparisonOperator, right: pd.Series
) -> pd.Series:
    if comparator == ComparisonOperator.GREATER_THAN:
        return left > right
    if comparator == ComparisonOperator.GREATER_THAN_OR_EQUAL:
        return left >= right
    if comparator == ComparisonOperator.LESS_THAN:
        return left < right
    if comparator == ComparisonOperator.LESS_THAN_OR_EQUAL:
        return left <= right
    if comparator == ComparisonOperator.EQUAL:
        return left == right
    if comparator == ComparisonOperator.CROSSES_ABOVE:
        return (left > right) & (left.shift(1) <= right.shift(1))
    if comparator == ComparisonOperator.CROSSES_BELOW:
        return (left < right) & (left.shift(1) >= right.shift(1))

    raise ValueError(f"Unsupported comparator '{comparator}'")


class CustomStrategy(Strategy):
    """Evaluate a saved custom definition against OHLCV data."""

    def __init__(self, params: dict[str, Any], risk) -> None:
        super().__init__(params, risk)
        self.definition = CustomStrategyDefinition.model_validate(
            params.get("custom_definition")
        )

    def _ensure_supported_shape(self) -> None:
        if self.definition.shortEntry.conditions or self.definition.shortExit.conditions:
            raise ValueError(
                "Custom backtests currently support long-entry and long-exit rules only. Remove short-side rules before running."
            )
        if not self.definition.longEntry.conditions:
            raise ValueError("Custom backtests require at least one long-entry rule.")
        if not self.definition.longExit.conditions:
            raise ValueError("Custom backtests require at least one long-exit rule.")

    def _build_indicator_cache(
        self, df: pd.DataFrame
    ) -> dict[str, dict[IndicatorOutputKey, pd.Series]]:
        return {
            indicator.id: _compute_indicator_outputs(df, indicator)
            for indicator in self.definition.indicators
        }

    def _resolve_operand(
        self,
        df: pd.DataFrame,
        indicator_cache: dict[str, dict[IndicatorOutputKey, pd.Series]],
        operand: PriceOperand | IndicatorOperand | ConstantOperand,
    ) -> pd.Series:
        if isinstance(operand, PriceOperand):
            return df[PRICE_FIELD_MAP[operand.field]].astype(float)

        if isinstance(operand, IndicatorOperand):
            indicator_outputs = indicator_cache.get(operand.indicatorId)
            if indicator_outputs is None:
                raise ValueError(
                    f"Missing computed indicator '{operand.indicatorId}' in custom strategy"
                )

            output_key = operand.output or IndicatorOutputKey.VALUE
            resolved = indicator_outputs.get(output_key)
            if resolved is None:
                raise ValueError(
                    f"Indicator '{operand.indicatorId}' does not expose output '{output_key.value}'"
                )
            return resolved.astype(float)

        return pd.Series(float(operand.value), index=df.index, dtype=float)

    def _evaluate_node(
        self,
        df: pd.DataFrame,
        indicator_cache: dict[str, dict[IndicatorOutputKey, pd.Series]],
        node: RuleNode,
    ) -> pd.Series:
        if isinstance(node, RuleCondition):
            left = self._resolve_operand(df, indicator_cache, node.left)
            right = self._resolve_operand(df, indicator_cache, node.right)
            return _evaluate_comparator(left, node.comparator, right).fillna(False)

        if not node.conditions:
            return pd.Series(False, index=df.index, dtype=bool)

        evaluated_children = [
            self._evaluate_node(df, indicator_cache, child).fillna(False)
            for child in node.conditions
        ]

        if node.operator.value == "AND":
            return pd.concat(evaluated_children, axis=1).all(axis=1)

        return pd.concat(evaluated_children, axis=1).any(axis=1)

    def generate_signals(self, df: pd.DataFrame) -> pd.DataFrame:
        self._ensure_supported_shape()
        indicator_cache = self._build_indicator_cache(df)
        long_entry = self._evaluate_node(df, indicator_cache, self.definition.longEntry)
        long_exit = self._evaluate_node(df, indicator_cache, self.definition.longExit)

        df = df.copy()
        df["signal"] = 0
        in_position = False

        for index in range(len(df)):
            if not in_position and bool(long_entry.iloc[index]):
                df.iloc[index, df.columns.get_loc("signal")] = 1
                in_position = True
            elif in_position and bool(long_exit.iloc[index]):
                df.iloc[index, df.columns.get_loc("signal")] = -1
                in_position = False

        return df