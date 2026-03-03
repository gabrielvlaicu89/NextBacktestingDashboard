"""Mean Reversion strategy — Z-score based entries and exits."""
from __future__ import annotations

import pandas as pd

from app.engine.base import Strategy


class MeanReversionStrategy(Strategy):
    """
    Buy when Z-score < -threshold (price below mean).
    Sell when Z-score > +threshold or after max holding period.
    """

    def generate_signals(self, df: pd.DataFrame) -> pd.DataFrame:
        window = int(self.params.get("zscore_window", 20))
        threshold = float(self.params.get("zscore_threshold", 2.0))
        holding_period = int(self.params.get("holding_period", 10))

        close = df["Close"]
        rolling_mean = close.rolling(window).mean()
        rolling_std = close.rolling(window).std()
        zscore = (close - rolling_mean) / rolling_std.replace(0, float("nan"))

        df["signal"] = 0
        in_trade = False
        entry_idx = None

        for i in range(len(df)):
            z = zscore.iloc[i]
            if pd.isna(z):
                continue
            if not in_trade and z < -threshold:
                df.iloc[i, df.columns.get_loc("signal")] = 1
                in_trade = True
                entry_idx = i
            elif in_trade:
                days_held = i - entry_idx if entry_idx is not None else 0
                if z > threshold or days_held >= holding_period:
                    df.iloc[i, df.columns.get_loc("signal")] = -1
                    in_trade = False
                    entry_idx = None

        return df
