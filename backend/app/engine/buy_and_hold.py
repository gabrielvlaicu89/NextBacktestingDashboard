"""Buy & Hold strategy — enter day 1, exit last day. Pure baseline."""

from __future__ import annotations

import pandas as pd

from app.engine.base import Strategy


class BuyAndHoldStrategy(Strategy):
    """Buys on the first available day and holds until the end of the period."""

    def generate_signals(self, df: pd.DataFrame) -> pd.DataFrame:
        df["signal"] = 0
        if len(df) > 1:
            df.iloc[0, df.columns.get_loc("signal")] = 1  # buy on day 1
            df.iloc[-1, df.columns.get_loc("signal")] = -1  # sell on last day
        return df
