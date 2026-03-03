"""Data fetching service — wraps yfinance and Alpha Vantage."""
from __future__ import annotations

import functools
from datetime import date

import pandas as pd
import yfinance as yf


# Simple in-memory cache keyed by (ticker, date_from, date_to)
@functools.lru_cache(maxsize=256)
def fetch_ohlcv(ticker: str, date_from: date, date_to: date) -> pd.DataFrame:
    """
    Download OHLCV data from Yahoo Finance via yfinance.
    Returns a DataFrame indexed by date with columns: Open, High, Low, Close, Volume.
    Raises ValueError for invalid tickers or insufficient data.
    """
    df = yf.download(
        ticker,
        start=str(date_from),
        end=str(date_to),
        auto_adjust=True,
        progress=False,
        actions=False,
    )

    if df.empty:
        raise ValueError(f"No data returned for ticker '{ticker}' in range {date_from} – {date_to}. "
                         "Check that the ticker is valid and the date range is correct.")

    if len(df) < 10:
        raise ValueError(f"Insufficient data for '{ticker}': only {len(df)} trading days found. "
                         "Try a wider date range.")

    # Flatten MultiIndex columns if present (yfinance ≥ 0.2.x can return MultiIndex)
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = df.columns.get_level_values(0)

    return df[["Open", "High", "Low", "Close", "Volume"]].dropna()


def get_earnings_dates(ticker: str, api_key: str) -> list[str]:
    """
    Fetch historical earnings dates from Alpha Vantage.
    Returns list of date strings in ISO format (YYYY-MM-DD).
    NOTE: Full implementation in Phase 3.
    """
    # TODO: implement in Phase 3
    # from alpha_vantage.fundamentaldata import FundamentalData
    # fd = FundamentalData(key=api_key)
    # data, _ = fd.get_earnings(symbol=ticker)
    # return [row["fiscalDateEnding"] for row in data.get("annualEarnings", [])]
    return []
