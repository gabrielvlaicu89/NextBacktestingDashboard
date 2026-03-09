"""Ticker search router — proxies Yahoo Finance autocomplete."""

import httpx
from fastapi import APIRouter, Query

from app.models.schemas import TickerResult

router = APIRouter()


@router.get("/search", response_model=list[TickerResult])
async def search_tickers(q: str = Query(..., min_length=1)):
    """Search Yahoo Finance for matching tickers."""
    url = "https://query1.finance.yahoo.com/v1/finance/search"
    params = {"q": q, "quotesCount": 10, "newsCount": 0, "listsCount": 0}
    headers = {"User-Agent": "Mozilla/5.0"}

    async with httpx.AsyncClient(timeout=5) as client:
        resp = await client.get(url, params=params, headers=headers)
        resp.raise_for_status()
        data = resp.json()

    results = []
    for quote in data.get("quotes", []):
        if quote.get("symbol") and quote.get("quoteType") in ("EQUITY", "ETF"):
            results.append(
                TickerResult(
                    symbol=quote["symbol"],
                    name=quote.get("longname") or quote.get("shortname", ""),
                    exchange=quote.get("exchange", ""),
                    type=quote.get("quoteType", ""),
                )
            )
    return results
