"""Earnings Drift (PEAD) strategy — trades around earnings announcements."""

from __future__ import annotations

import pandas as pd

from app.engine.base import Strategy


class EarningsDriftStrategy(Strategy):
    """
    Post-Earnings Announcement Drift (PEAD).
    Enters N days before an earnings date, exits M days after.
    Only trades earnings events where |EPS surprise| exceeds the configured threshold.

    Expects self.params["_earnings_data"] to be injected by the backtest router:
      list of {date, reported_eps, estimated_eps, surprise_pct}
    """

    def generate_signals(self, df: pd.DataFrame) -> pd.DataFrame:
        earnings_data: list[dict] = self.params.get("_earnings_data", [])
        days_before = int(self.params.get("days_before", 2))
        days_after = int(self.params.get("days_after", 5))
        surprise_threshold = abs(float(self.params.get("eps_surprise_threshold", 0.0)))

        df["signal"] = 0
        if not earnings_data:
            return df

        # Filter earnings by surprise threshold
        qualifying = [
            e
            for e in earnings_data
            if abs(e.get("surprise_pct", 0)) >= surprise_threshold
        ]

        trading_dates = list(df.index)
        date_strs = [
            str(dt.date()) if hasattr(dt, "date") else str(dt) for dt in trading_dates
        ]
        date_to_idx = {d: i for i, d in enumerate(date_strs)}

        for earning in qualifying:
            earn_date = earning["date"]
            if earn_date not in date_to_idx:
                # Find the nearest trading date on or after the earnings date
                earn_idx = None
                for i, d in enumerate(date_strs):
                    if d >= earn_date:
                        earn_idx = i
                        break
                if earn_idx is None:
                    continue
            else:
                earn_idx = date_to_idx[earn_date]

            buy_idx = max(0, earn_idx - days_before)
            sell_idx = min(len(trading_dates) - 1, earn_idx + days_after)

            # Only place signals if not overlapping with an existing trade
            if df.iloc[buy_idx, df.columns.get_loc("signal")] == 0:
                df.iloc[buy_idx, df.columns.get_loc("signal")] = 1
            if df.iloc[sell_idx, df.columns.get_loc("signal")] == 0:
                df.iloc[sell_idx, df.columns.get_loc("signal")] = -1

        return df
