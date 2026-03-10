// Shared CRAWL_SECRET auth verification for Edge Functions (no deno-dom dependency)
import { timingSafeEqual } from "https://deno.land/std@0.224.0/crypto/timing_safe_equal.ts";

/** Verify CRAWL_SECRET header using constant-time comparison */
export function verifyCrawlSecret(req: Request): Response | null {
  const secret = Deno.env.get("CRAWL_SECRET");
  if (!secret) {
    console.warn("CRAWL_SECRET env var is not set");
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const provided =
    req.headers.get("x-crawl-secret") ||
    req.headers.get("authorization")?.replace("Bearer ", "");

  if (!provided) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();
  const a = encoder.encode(secret);
  const b = encoder.encode(provided);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  return null;
}
