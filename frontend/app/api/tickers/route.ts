/**
 * GET /api/tickers?q=...
 *
 * Proxies the Yahoo Finance ticker autocomplete from the FastAPI backend.
 * Auth-gated — only signed-in users can search tickers.
 */
import { getServerSession } from "@/lib/auth";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

export async function GET(req: Request) {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q");

  if (!query || query.length < 1) {
    return Response.json({ error: "Query parameter 'q' is required" }, { status: 400 });
  }

  try {
    const response = await fetch(
      `${BACKEND_URL}/api/tickers/search?q=${encodeURIComponent(query)}`,
      { headers: { "Content-Type": "application/json" } },
    );

    if (!response.ok) {
      return Response.json(
        { error: "Backend ticker search failed" },
        { status: response.status },
      );
    }

    const data = await response.json();
    return Response.json(data);
  } catch {
    return Response.json({ error: "Backend service unavailable" }, { status: 502 });
  }
}
