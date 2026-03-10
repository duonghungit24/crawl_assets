// Shared HTML parsing utilities for VN price crawlers
import { DOMParser } from "https://deno.land/x/deno_dom/deno-dom-wasm.ts";

// Re-export auth helper so existing VN crawlers keep working
export { verifyCrawlSecret } from "./crawl-auth.ts";

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

