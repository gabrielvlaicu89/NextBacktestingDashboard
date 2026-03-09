"""Pairs Trading strategy — spread Z-score mean reversion."""

from __future__ import annotations

from typing import Any

import pandas as pd
from scipy import stats

from app.engine.base import Strategy
from app.models.schemas import RiskSettings


class PairsTradingStrategy(Strategy):
    """
    Trades the spread between ticker A (primary) and ticker B.
    Goes long on A when the spread Z-score drops below -threshold (A is cheap
    relative to B), and exits when the spread reverts toward the mean.
    """

    def __init__(self, params: dict[str, Any], risk: RiskSettings) -> None:
        super().__init__(params, risk)
        self._df_b: pd.DataFrame | None = None

    def set_df_b(self, df_b: pd.DataFrame) -> None:
        """Inject ticker B's OHLCV DataFrame before running the strategy."""
        self._df_b = df_b

    def generate_signals(self, df: pd.DataFrame) -> pd.DataFrame:
        if self._df_b is None:
            raise ValueError(
                "Ticker B DataFrame not set. Call set_df_b() before running."
            )

        threshold = float(self.params.get("spread_threshold", 2.0))
        window = int(self.params.get("correlation_window", 60))

        close_a = df["Close"]
        close_b = self._df_b["Close"].reindex(df.index).ffill()

        # Drop rows where either series is NaN before OLS
        valid = close_a.notna() & close_b.notna()
        if valid.sum() < window:
            df["signal"] = 0
            return df

        slope, intercept, *_ = stats.linregress(close_b[valid], close_a[valid])
        spread = close_a - (slope * close_b + intercept)

        rolling_mean = spread.rolling(window).mean()
        rolling_std = spread.rolling(window).std()
        zscore = (spread - rolling_mean) / rolling_std.replace(0, float("nan"))

        df["signal"] = 0
        in_trade = False

        for i in range(len(df)):
            z = zscore.iloc[i]
            if pd.isna(z):
                continue
            if not in_trade:
                if z < -threshold:
                    df.iloc[i, df.columns.get_loc("signal")] = 1  # spread low → buy A
                    in_trade = True
            else:
                if z > -0.5:
                    df.iloc[i, df.columns.get_loc("signal")] = -1  # reverted → sell A
                    in_trade = False

        return df
