# Lesson 05 — FastAPI & the Python Backend

## Why a Separate Python Service?

We could have built the entire application in one Next.js project. So why introduce a separate Python backend? The answer is the **Python data science ecosystem**.

The core libraries we depend on — `yfinance`, `pandas`, `numpy`, `scipy` — are Python-native. They don't exist for Node.js in any meaningful form. `yfinance` alone handles stock data download with caching and ticker normalization that would take months to replicate elsewhere. `scipy` gives us statistical tests like Engle-Granger cointegration in a single function call.

The architecture is therefore:

```
Browser
  ↓ React UI
Next.js (TypeScript)      ← User authentication, UI, persistence
  ↓ HTTP POST /api/backtest/run
FastAPI (Python)          ← Data fetching, strategy math, metrics
  ↓
Supabase (PostgreSQL)     ← Shared database (written to by both services eventually)
```

FastAPI handles only what Python does best: number crunching. Next.js handles everything else.

## Why FastAPI Over Flask?

Flask was the dominant Python web framework for years. FastAPI is better for our use case for three reasons:

**1. Async support.** FastAPI is built on ASGI (Async Server Gateway Interface), meaning it can handle multiple concurrent requests without blocking. This matters when multiple users run backtests simultaneously. Flask is WSGI — synchronous by default.

**2. Pydantic integration.** FastAPI automatically validates request bodies against Pydantic models and rejects requests that don't conform — no manual validation code. It also auto-generates an OpenAPI spec (Swagger UI at `/docs`) that documents every endpoint for free.

**3. Type hints everywhere.** FastAPI uses Python type hints natively. The function signature itself becomes both documentation and validation:

```python
@router.post("/run")
async def run_backtest(request: BacktestRequest) -> StreamingResponse:
    ...
```

Here `BacktestRequest` is a Pydantic model. FastAPI reads the request body, validates it, and injecs a fully populated `BacktestRequest` object. If the client sends invalid data, FastAPI returns a 422 error automatically.

## Pydantic v2 Models

Pydantic is Python's data validation library. We use it to define the shape of every request and response. In `app/models/schemas.py`:

```python
class BacktestRequest(BaseModel):
    strategy_type: str
    ticker: str
    date_from: datetime
    date_to: datetime
    starting_capital: float = 10000.0
    parameters: dict[str, Any] = {}
    risk: RiskSettings = RiskSettings()
```

Notice `= 10000.0` and `= RiskSettings()` — these are default values. Clients don't have to supply these fields; Pydantic fills them in.

### Pydantic v2 vs v1

We use Pydantic v2 (declared via `pydantic>=2.0` in `requirements.txt`). The main differences you'll notice in the code:

- `model_validate()` instead of `.parse_obj()`
- `model_dump()` instead of `.dict()`
- `model_json_schema()` instead of `.schema()`
- Validators use `@field_validator` instead of `@validator`

Pydantic v2 is significantly faster than v1 (its core was rewritten in Rust) and stricter by default.

## Router Organization

Rather than registering all routes in `main.py`, we split them into router modules:

```
app/
├── main.py              ← App setup, CORS, mount routers
└── routers/
    ├── backtest.py      ← /api/backtest/*
    ├── tickers.py       ← /api/tickers/*
    └── strategies.py   ← /api/strategies/*
```

Each router file creates an `APIRouter` instance:

```python
# app/routers/backtest.py
from fastapi import APIRouter

router = APIRouter(prefix="/api/backtest", tags=["backtest"])

@router.post("/run")
async def run_backtest(request: BacktestRequest):
    ...
```

In `main.py`, we mount them:

```python
app.include_router(backtest.router)
app.include_router(tickers.router)
app.include_router(strategies.router)
```

This keeps files small and focused. Adding a new feature means creating a new router file and one `include_router` call.

## CORS Configuration

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)
```

Browsers enforce the **Same-Origin Policy**: JavaScript on `http://localhost:3000` cannot call `http://localhost:8000` unless the server explicitly allows it. CORS (Cross-Origin Resource Sharing) is the mechanism for that permission.

`CORSMiddleware` intercepts preflight `OPTIONS` requests and adds the required `Access-Control-Allow-Origin` headers. Without this, every fetch from the frontend to the backend would be blocked by the browser.

In production, `allow_origins` would be tightened to your actual domain (`https://yourdomain.com`) rather than `*`.

## Server-Sent Events (SSE) for Streaming

Backtests can take seconds to complete. Instead of having the client wait in silence and then receive a dump of data, we stream progress updates as they're computed:

```python
from fastapi.responses import StreamingResponse

async def event_generator(request: BacktestRequest):
    # Send progress as data becomes available
    yield f"data: {json.dumps({'status': 'fetching_data'})}\n\n"
    df = fetch_ohlcv(request.ticker, ...)

    yield f"data: {json.dumps({'status': 'running_strategy'})}\n\n"
    # ... run strategy ...

    yield f"data: {json.dumps({'status': 'complete', 'result': result})}\n\n"

@router.post("/run")
async def run_backtest(request: BacktestRequest):
    return StreamingResponse(
        event_generator(request),
        media_type="text/event-stream"
    )
```

On the frontend, this will be consumed with the `EventSource` API or the `fetch` streaming API, letting us show a progress indicator in real time.

## The Health Endpoint

```python
@app.get("/health")
async def health():
    return {"status": "ok"}
```

This simple endpoint serves multiple purposes:
- Docker can use it as a health check to know when the service is ready
- The frontend can poll it to detect if the backend is reachable
- DevOps tooling uses it for uptime monitoring

Every service should have one.

## Running the Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

`uvicorn` is the ASGI server that runs FastAPI. `--reload` enables hot-reload (restarts on file changes). Visit `http://localhost:8000/docs` to see the auto-generated Swagger UI for all your endpoints.

---

**Next:** [Lesson 06 — Strategy Engine Design Pattern](./06-strategy-engine-design-pattern.md)
