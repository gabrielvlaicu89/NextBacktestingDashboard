## Summary
<!-- Describe what this PR does and why. Link to the relevant issue if applicable. -->
Closes #

---

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Refactor / code cleanup
- [ ] Strategy implementation
- [ ] Infrastructure / DevOps
- [ ] Documentation

## Affected Area
- [ ] Frontend — UI / UX
- [ ] Frontend — Redux state
- [ ] Frontend — API proxy layer
- [ ] Backend — Strategy engine
- [ ] Backend — FastAPI endpoints
- [ ] Backend — Metrics / Optimizer
- [ ] Auth / Prisma / Database
- [ ] CI / DevOps

---

## Checklist

### General
- [ ] Code follows the project's conventions (PEP 8 for Python, strict TS for frontend)
- [ ] No `any` types introduced in TypeScript
- [ ] No secrets or API keys committed
- [ ] `.env.example` updated if new environment variables were added
- [ ] `requirements.txt` updated if new Python packages were added
- [ ] `package.json` updated with justification if new npm packages were added

### Frontend
- [ ] Server Components used where possible; `"use client"` only where necessary
- [ ] Zod schemas added/updated for all new form or API payloads
- [ ] Redux slices registered in `store/store.ts` if new slices added
- [ ] No data fetching in Client Components that could be done server-side

### Backend
- [ ] Pydantic v2 models defined in `models/schemas.py` for new request/response shapes
- [ ] `HTTPException` raised with appropriate status codes — no silent exception swallowing
- [ ] SSE events follow the structured format: `{ "type": "progress|complete|error", ... }`
- [ ] New strategy extends `engine/base.py` and implements `generate_signals` + `execute_trades`

### Testing
- [ ] Unit tests added/updated for strategy logic or metrics
- [ ] Integration test added for any new FastAPI endpoint
- [ ] Manually tested locally (both frontend and backend)

---

## Screenshots / Recordings
<!-- For UI changes, include before/after screenshots or a short screen recording. -->

## Notes for Reviewer
<!-- Anything specific you want the reviewer to focus on or be aware of. -->
