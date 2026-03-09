"""Abstract base class for all strategies, plus factory function."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any

import pandas as pd

from app.models.schemas import RiskSettings, StrategyType


@dataclass
class Trade:
    entry_date: str
    exit_date: str
    entry_price: float
    exit_price: float
    pnl: float
    pnl_pct: float
    holding_days: int
    exit_reason: str


class Strategy(ABC):
    """Abstract base for all backtesting strategies."""

    def __init__(self, params: dict[str, Any], risk: RiskSettings) -> None:
        self.params = params
        self.risk = risk

    @abstractmethod
    def generate_signals(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Add a `signal` column to df:
          +1 = buy
          -1 = sell
           0 = hold
        Returns modified DataFrame.
        """
        ...

    def execute_trades(
        self, df: pd.DataFrame, capital: float
    ) -> tuple[list[Trade], list[dict]]:
        """
        Simulate portfolio execution from signals.
        Returns (trades, equity_curve).
        equity_curve items: {"date": str, "value": float}
        """
        df = self.generate_signals(df.copy())
        trades: list[Trade] = []
        equity_curve: list[dict] = []

        cash = capital
        position = 0.0  # shares held
        entry_price = 0.0
        entry_date = ""
        portfolio_value = capital

        stop_loss = self.risk.stop_loss_pct / 100 if self.risk.stop_loss_pct else None
        take_profit = (
            self.risk.take_profit_pct / 100 if self.risk.take_profit_pct else None
        )

        for _, row in df.iterrows():
            date_str = (
                str(row.name.date()) if hasattr(row.name, "date") else str(row.name)
            )
            close = float(row["Close"])

            # Check stop-loss / take-profit on open position
            if position > 0 and entry_price > 0:
                ret = (close - entry_price) / entry_price
                if stop_loss and ret <= -stop_loss:
                    pnl = (close - entry_price) * position
                    trades.append(
                        Trade(
                            entry_date=entry_date,
                            exit_date=date_str,
                            entry_price=entry_price,
                            exit_price=close,
                            pnl=round(pnl, 2),
                            pnl_pct=round(ret * 100, 4),
                            holding_days=_calc_days(entry_date, date_str),
                            exit_reason="stop_loss",
                        )
                    )
                    cash += close * position
                    position = 0.0
                elif take_profit and ret >= take_profit:
                    pnl = (close - entry_price) * position
                    trades.append(
                        Trade(
                            entry_date=entry_date,
                            exit_date=date_str,
                            entry_price=entry_price,
                            exit_price=close,
                            pnl=round(pnl, 2),
                            pnl_pct=round(ret * 100, 4),
                            holding_days=_calc_days(entry_date, date_str),
                            exit_reason="take_profit",
                        )
                    )
                    cash += close * position
                    position = 0.0

            # Process signal
            signal = int(row.get("signal", 0))

            if signal == 1 and position == 0:
                # Buy
                if self.risk.position_sizing_mode.value == "FIXED_DOLLAR":
                    spend = min(self.risk.position_size, cash)
                else:
                    spend = cash * (self.risk.position_size / 100)
                if close > 0:
                    position = spend / close
                    cash -= spend
                    entry_price = close
                    entry_date = date_str

            elif signal == -1 and position > 0:
                # Sell
                ret = (close - entry_price) / entry_price
                pnl = (close - entry_price) * position
                trades.append(
                    Trade(
                        entry_date=entry_date,
                        exit_date=date_str,
                        entry_price=entry_price,
                        exit_price=close,
                        pnl=round(pnl, 2),
                        pnl_pct=round(ret * 100, 4),
                        holding_days=_calc_days(entry_date, date_str),
                        exit_reason="signal",
                    )
                )
                cash += close * position
                position = 0.0

            portfolio_value = cash + position * close
            equity_curve.append({"date": date_str, "value": round(portfolio_value, 2)})

        # Close any open position at end
        if position > 0:
            close = float(df["Close"].iloc[-1])
            date_str = (
                str(df.index[-1].date())
                if hasattr(df.index[-1], "date")
                else str(df.index[-1])
            )
            ret = (close - entry_price) / entry_price
            pnl = (close - entry_price) * position
            trades.append(
                Trade(
                    entry_date=entry_date,
                    exit_date=date_str,
                    entry_price=entry_price,
                    exit_price=close,
                    pnl=round(pnl, 2),
                    pnl_pct=round(ret * 100, 4),
                    holding_days=_calc_days(entry_date, date_str),
                    exit_reason="end_of_period",
                )
            )

        return trades, equity_curve

    def run(self, df: pd.DataFrame, capital: float) -> tuple[list[Trade], list[dict]]:
        return self.execute_trades(df, capital)


def _calc_days(start: str, end: str) -> int:
    from datetime import date

    try:
        d1 = date.fromisoformat(start)
        d2 = date.fromisoformat(end)
        return (d2 - d1).days
    except Exception:
        return 0


def get_strategy(
    strategy_type: StrategyType, params: dict[str, Any], risk: RiskSettings
) -> Strategy:
    """Factory — return the appropriate Strategy subclass instance."""
    from app.engine.mean_reversion import MeanReversionStrategy
    from app.engine.ma_crossover import MACrossoverStrategy
    from app.engine.earnings_drift import EarningsDriftStrategy
    from app.engine.pairs_trading import PairsTradingStrategy
    from app.engine.buy_and_hold import BuyAndHoldStrategy

    mapping = {
        StrategyType.MEAN_REVERSION: MeanReversionStrategy,
        StrategyType.MA_CROSSOVER: MACrossoverStrategy,
        StrategyType.EARNINGS_DRIFT: EarningsDriftStrategy,
        StrategyType.PAIRS_TRADING: PairsTradingStrategy,
        StrategyType.BUY_AND_HOLD: BuyAndHoldStrategy,
    }
    cls = mapping[strategy_type]
    return cls(params, risk)
