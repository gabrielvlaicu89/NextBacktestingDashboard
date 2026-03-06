/**
 * POST /api/optimize
 *
 * Proxies an optimization request to the FastAPI grid-search endpoint and
 * streams the SSE response directly back to the client.
 *
 * The client sends: { strategy_type, ticker, date_from, date_to, benchmark,
 *   risk_settings, fixed_parameters, param_ranges, optimize_for }
 */

import { getServerSession } from "@/lib/auth";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

export async function POST(req: Request) {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Proxy to the FastAPI optimizer
  let fastApiResponse: Response;
  try {
    fastApiResponse = await fetch(`${BACKEND_URL}/api/backtest/optimize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    const errEvent = `data: ${JSON.stringify({ type: "error", message: "Backend service unavailable" })}\n\n`;
    return new Response(errEvent, {
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
    });
  }

  if (!fastApiResponse.ok || !fastApiResponse.body) {
    const errText = await fastApiResponse.text().catch(() => "Backend error");
    const errEvent = `data: ${JSON.stringify({ type: "error", message: errText })}\n\n`;
    return new Response(errEvent, {
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
    });
  }

  // Stream the FastAPI SSE response directly to the client
  return new Response(fastApiResponse.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
}
