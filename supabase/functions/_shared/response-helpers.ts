// Shared HTTP response helpers for Edge Functions

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-crawl-secret",
};

/** Return JSON response with CORS headers */
export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

/** Return error JSON response */
export function errorResponse(message: string, status = 500): Response {
  return jsonResponse({ error: message }, status);
}

/** Handle CORS preflight OPTIONS request */
export function corsResponse(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
