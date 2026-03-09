"""
FastAPI backtesting microservice entry point.
"""

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import backtest, tickers, strategies

# Load .env variables (ALPHA_VANTAGE_API_KEY, etc.) before any route handler uses them
load_dotenv()

app = FastAPI(
    title="Backtester API",
    description="Python microservice for running strategy backtests.",
    version="0.1.0",
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",  # Next.js dev server
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(backtest.router, prefix="/api/backtest", tags=["Backtest"])
app.include_router(tickers.router, prefix="/api/tickers", tags=["Tickers"])
app.include_router(strategies.router, prefix="/api/strategies", tags=["Strategies"])


@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "ok"}
