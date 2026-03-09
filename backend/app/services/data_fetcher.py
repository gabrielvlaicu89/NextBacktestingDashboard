"""Data fetching service — wraps yfinance and Alpha Vantage."""
from __future__ import annotations

import functools
import os
import threading
import time
from datetime import date

import httpx
import pandas as pd
import yfinance as yf
from loguru import logger


# ── Alpha Vantage rate limiter (25 req/day ≈ 1 every 3.5 min) ─────────────────

class _AlphaVantageRateLimiter:
    """Thread-safe rate limiter for Alpha Vantage free tier (25 req/day)."""

    def __init__(self, max_per_day: int = 25):
        self._lock = threading.Lock()
        self._timestamps: list[float] = []
        self._window = 86_400  # 24 hours in seconds
        self._max = max_per_day

    def acquire(self, timeout: float = 60) -> bool:
        """Block until a request slot is available or timeout expires.
        Returns True if acquired, False on timeout."""
        deadline = time.monotonic() + timeout
        while True:
            with self._lock:
                now = time.monotonic()
                # Prune expired timestamps
                self._timestamps = [t for t in self._timestamps if now - t < self._window]
                if len(self._timestamps) < self._max:
                    self._timestamps.append(now)
                    return True
            if time.monotonic() >= deadline:
                return False
            time.sleep(1)


_av_limiter = _AlphaVantageRateLimiter()


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
        raise ValueError(
            f"No data returned for ticker '{ticker}' in range {date_from} – {date_to}. "
            "The ticker may be invalid, delisted, or the date range may predate its listing."
        )

    if len(df) < 10:
        raise ValueError(
            f"Insufficient data for '{ticker}': only {len(df)} trading days found "
            f"in range {date_from} – {date_to}. "
            "Try a wider date range (weekends and holidays are excluded automatically)."
        )

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
        if not _av_limiter.acquire(timeout=60):
            logger.warning(f"Alpha Vantage rate limit reached for '{ticker}' — skipping")
            return []

        with httpx.Client(timeout=10) as client:
            resp = client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()

        # Alpha Vantage returns a "Note" key when rate-limited
        if "Note" in data:
            logger.warning(f"Alpha Vantage rate limit note for '{ticker}': {data['Note']}")
            return []
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
