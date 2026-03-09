/**
 * GET /api/backtest?runId=xxx
 *
 * SSE streaming endpoint — reads a BacktestRun's config from Prisma,
 * proxies the request to the FastAPI SSE endpoint, forwards events to
 * the client, and updates the BacktestRun record on completion/error.
 *
 * Designed to be consumed by EventSource on the client side.
 */
import { getServerSession } from "@/lib/auth";
import { requireCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

function parseSseJson(raw: string) {
  return JSON.parse(
    raw.replace(/\b(?:NaN|Infinity|-Infinity)\b/g, "null"),
  );
}

export async function GET(req: Request) {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = await requireCurrentUser();

  const { searchParams } = new URL(req.url);
  const runId = searchParams.get("runId");

  if (!runId) {
    return Response.json({ error: "runId query parameter is required" }, { status: 400 });
  }

  // Fetch the BacktestRun + associated Strategy from DB
  const run = await prisma.backtestRun.findUnique({
    where: { id: runId },
    include: { strategy: true },
  });

  if (!run) {
    return Response.json({ error: "Backtest run not found" }, { status: 404 });
  }

  if (run.userId !== user.id) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  // If already completed, return cached results as a single SSE event
  if (run.status === "COMPLETED" && run.results) {
    const body = `data: ${JSON.stringify({ type: "complete", results: run.results })}\n\n`;
    return new Response(body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

  // If already failed, return the error
  if (run.status === "FAILED") {
    const body = `data: ${JSON.stringify({ type: "error", message: run.errorMsg || "Run failed" })}\n\n`;
    return new Response(body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

  // Build the FastAPI request payload from the stored strategy config
  const strategy = run.strategy;
  const riskSettings = strategy.riskSettings as Record<string, unknown>;
  const parameters = strategy.parameters as Record<string, unknown>;

  const payload = {
    strategy_type: strategy.type,
    ticker: strategy.ticker,
    date_from: strategy.dateFrom.toISOString().split("T")[0],
    date_to: strategy.dateTo.toISOString().split("T")[0],
    benchmark: strategy.benchmark,
    risk_settings: riskSettings,
    parameters,
  };

  // Mark run as RUNNING
  await prisma.backtestRun.update({
    where: { id: runId },
    data: { status: "RUNNING" },
  });

  const startTime = Date.now();

  // Proxy to FastAPI SSE endpoint
  let fastApiResponse: Response;
  try {
    fastApiResponse = await fetch(`${BACKEND_URL}/api/backtest/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    await prisma.backtestRun.update({
      where: { id: runId },
      data: { status: "FAILED", errorMsg: `Backend unreachable: ${err}`, duration: Date.now() - startTime },
    });
    const body = `data: ${JSON.stringify({ type: "error", message: "Backend service unavailable" })}\n\n`;
    return new Response(body, {
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
    });
  }

  if (!fastApiResponse.ok || !fastApiResponse.body) {
    const errText = await fastApiResponse.text().catch(() => "Unknown error");
    await prisma.backtestRun.update({
      where: { id: runId },
      data: { status: "FAILED", errorMsg: errText, duration: Date.now() - startTime },
    });
    const body = `data: ${JSON.stringify({ type: "error", message: "Backend error" })}\n\n`;
    return new Response(body, {
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
    });
  }

  // Stream FastAPI's SSE response to the client while capturing results
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  // Process in background — the Response is returned immediately
  const processStream = async () => {
    const reader = fastApiResponse.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split("\n\n");
        buffer = blocks.pop() || "";

        for (const block of blocks) {
          const trimmed = block.trim();
          if (!trimmed.startsWith("data: ")) continue;

          // Parse and persist complete/error events
          try {
            const data = parseSseJson(trimmed.slice(6)); // strip "data: "

            // Forward normalized JSON to the client so invalid numeric tokens
            // from the backend do not break EventSource consumers.
            await writer.write(
              encoder.encode(`data: ${JSON.stringify(data)}\n\n`),
            );

            if (data.type === "complete" && data.results) {
              await prisma.backtestRun.update({
                where: { id: runId },
                data: {
                  status: "COMPLETED",
                  results: data.results,
                  duration: Date.now() - startTime,
                },
              });
            } else if (data.type === "error") {
              await prisma.backtestRun.update({
                where: { id: runId },
                data: {
                  status: "FAILED",
                  errorMsg: data.message || "Unknown backend error",
                  duration: Date.now() - startTime,
                },
              });
            }
          } catch {
            // JSON parse error — keep the raw event flowing to the client.
            await writer.write(encoder.encode(trimmed + "\n\n"));
          }
        }
      }
    } catch (err) {
      // Stream read error — mark run as failed
      await prisma.backtestRun.update({
        where: { id: runId },
        data: { status: "FAILED", errorMsg: String(err), duration: Date.now() - startTime },
      });
      const errorEvent = `data: ${JSON.stringify({ type: "error", message: "Stream interrupted" })}\n\n`;
      await writer.write(encoder.encode(errorEvent)).catch(() => {});
    } finally {
      await writer.close().catch(() => {});
    }
  };

  processStream();

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
