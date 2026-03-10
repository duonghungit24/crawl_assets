// Shared HTML parsing utilities for VN price crawlers
import { DOMParser } from "https://deno.land/x/deno_dom/deno-dom-wasm.ts";
import { timingSafeEqual } from "https://deno.land/std/crypto/timing_safe_equal.ts";

/** Parse HTML string into a Document */
export function parseHTML(html: string) {
  return new DOMParser().parseFromString(html, "text/html");
}

/**
 * Parse XML by converting self-closing tags to open/close pairs,
 * then parsing as HTML. deno-dom only supports HTML mode.
 */
export function parseXML(xml: string) {
  // Convert <item .../> to <item ...></item> so HTML parser handles them
  const html = xml.replace(/<(\w+)([^>]*?)\/>/g, "<$1$2></$1>");
  return parseHTML(html);
}

/** Extract trimmed text content from an element */
export function extractText(el: Element | null): string {
  return el?.textContent?.trim() ?? "";
}

/**
 * Parse Vietnamese price format to number.
 * Handles "182.200.000" (gold) and "27.640" (fuel) — dots are thousand separators.
 * Returns 0 if parsing fails.
 */
export function parseVNPrice(text: string): number {
  const cleaned = text.replace(/\./g, "").replace(/,/g, "").trim();
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : 0;
}

/** Fetch URL with retry (1 retry after 2s delay), 30s timeout */
export async function fetchWithRetry(url: string): Promise<string> {
  const headers = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "vi-VN,vi;q=0.9,en;q=0.8",
  };

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30_000);
      const res = await fetch(url, { headers, signal: controller.signal });
      clearTimeout(timeoutId);

      if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
      return await res.text();
    } catch (err) {
      if (attempt === 0) {
        console.warn(`Fetch attempt 1 failed for ${url}: ${err}. Retrying...`);
        await new Promise((r) => setTimeout(r, 2000));
      } else {
        throw err;
      }
    }
  }
  throw new Error("Unreachable");
}

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
