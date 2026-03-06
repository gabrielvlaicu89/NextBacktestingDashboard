"""Data fetching service — wraps yfinance and Alpha Vantage."""
from __future__ import annotations

import functools
import os
from datetime import date

import httpx
import pandas as pd
import yfinance as yf
from loguru import logger


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


@functools.lru_cache(maxsize=128)
def fetch_earnings(ticker: str, api_key: str | None = None) -> list[dict]:
    """
    Fetch quarterly earnings data from Alpha Vantage.
    Returns list of dicts with keys: date, reported_eps, estimated_eps, surprise_pct
    sorted by date descending (most recent first).

    Falls back to an empty list if the API key is missing or the request fails.
    """
    key = api_key or os.environ.get("ALPHA_VANTAGE_API_KEY")
    if not key:
        logger.warning("ALPHA_VANTAGE_API_KEY not set — earnings data unavailable")
        return []

    url = "https://www.alphavantage.co/query"
    params = {
        "function": "EARNINGS",
        "symbol": ticker,
        "apikey": key,
    }

    try:
        with httpx.Client(timeout=10) as client:
            resp = client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()
    except Exception as exc:
        logger.error(f"Alpha Vantage request failed for '{ticker}': {exc}")
        return []

    if "quarterlyEarnings" not in data:
        logger.warning(
            f"No quarterly earnings in Alpha Vantage response for '{ticker}': "
            f"{list(data.keys())}"
        )
        return []

    results = []
    for item in data["quarterlyEarnings"]:
        try:
            reported = float(item.get("reportedEPS", 0) or 0)
            estimated = float(item.get("estimatedEPS", 0) or 0)
            surprise_pct = float(item.get("surprisePercentage", 0) or 0)
            results.append({
                "date": item["reportedDate"],
                "reported_eps": reported,
                "estimated_eps": estimated,
                "surprise_pct": surprise_pct,
            })
        except (ValueError, KeyError, TypeError):
            continue

    return results
