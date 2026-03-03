"""Moving Average Crossover strategy."""
from __future__ import annotations

import pandas as pd

from app.engine.base import Strategy


class MACrossoverStrategy(Strategy):
    """
    Buys on golden cross (fast MA crosses above slow MA).
    Sells on death cross (fast MA crosses below slow MA).
    """

    def generate_signals(self, df: pd.DataFrame) -> pd.DataFrame:
        fast = int(self.params.get("fast_period", 10))
        slow = int(self.params.get("slow_period", 50))
        ma_type = str(self.params.get("ma_type", "EMA")).upper()

        close = df["Close"]
        if ma_type == "EMA":
            fast_ma = close.ewm(span=fast, adjust=False).mean()
            slow_ma = close.ewm(span=slow, adjust=False).mean()
        else:
            fast_ma = close.rolling(fast).mean()
            slow_ma = close.rolling(slow).mean()

        df["signal"] = 0
        prev_above = fast_ma.iloc[slow] > slow_ma.iloc[slow]

        for i in range(slow + 1, len(df)):
            curr_above = fast_ma.iloc[i] > slow_ma.iloc[i]
            if curr_above and not prev_above:
                df.iloc[i, df.columns.get_loc("signal")] = 1   # golden cross → buy
            elif not curr_above and prev_above:
                df.iloc[i, df.columns.get_loc("signal")] = -1  # death cross → sell
            prev_above = curr_above

        return df
