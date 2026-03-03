"""Earnings Drift (PEAD) strategy — placeholder until Alpha Vantage integration."""
from __future__ import annotations

import pandas as pd

from app.engine.base import Strategy


class EarningsDriftStrategy(Strategy):
    """
    Post-Earnings Announcement Drift (PEAD).
    Enters N days before earnings date, exits M days after.
    Requires earnings dates from Alpha Vantage (data_fetcher.get_earnings_dates).

    NOTE: Full implementation in Phase 3 (requires Alpha Vantage integration).
    """

    def generate_signals(self, df: pd.DataFrame) -> pd.DataFrame:
        # Placeholder — earnings dates expected in self.params["earnings_dates"]
        earnings_dates: list[str] = self.params.get("earnings_dates", [])
        days_before = int(self.params.get("days_before", 2))
        days_after = int(self.params.get("days_after", 5))

        df["signal"] = 0
        trading_dates = list(df.index)
        earnings_set = set(earnings_dates)

        for i, dt in enumerate(trading_dates):
            dt_str = str(dt.date()) if hasattr(dt, "date") else str(dt)
            if dt_str in earnings_set:
                buy_idx = max(0, i - days_before)
                sell_idx = min(len(trading_dates) - 1, i + days_after)
                df.iloc[buy_idx, df.columns.get_loc("signal")] = 1
                df.iloc[sell_idx, df.columns.get_loc("signal")] = -1

        return df
