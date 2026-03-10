// Edge Function: Crawl Vietnamese gold prices from SJC, PNJ, DOJI via webgia.com
import { createServiceClient } from "../_shared/supabase-client.ts";
import { jsonResponse, errorResponse, corsResponse } from "../_shared/response-helpers.ts";
import {
  parseHTML,
  extractText,
  parseVNPrice,
  fetchWithRetry,
  verifyCrawlSecret,
} from "../_shared/html-parser.ts";

interface PriceRecord {
  symbol: string;
  price: number;
  bid: number | null;
  ask: number | null;
  unit: string;
  source: string;
  fetched_at: string;
}

/** Find all data rows from any table on the page */
function getTableRows(doc: ReturnType<typeof parseHTML>) {
  const selectors = [
    "table.table-radius tbody tr",
    "table.table-radius tr",
    "table tbody tr",
    "table tr",
  ];
  for (const sel of selectors) {
    const rows = doc?.querySelectorAll(sel) ?? [];
    const dataRows = [...rows].filter(
      (r) => r.querySelectorAll("td").length >= 2
    );
    if (dataRows.length > 0) return dataRows;
  }
  return [];
}

/** Check if a td cell is hex-obfuscated (webgia anti-scraping) */
function isObfuscated(el: Element): boolean {
  const cls = el.getAttribute("class") ?? "";
  return cls.includes("bgvtk") || cls.includes("gvd");
}

/**
 * Extract buy/sell from a webgia row.
 * Webgia uses <th> for region, so td cells are:
 *   [goldType, buy, sell] (3 cells) or [region, goldType, buy, sell] (4 cells)
 * Returns { goldType, bid, ask } or null if obfuscated/invalid.
 */
function parseWebgiaRow(row: Element) {
  const cells = row.querySelectorAll("td");
  if (cells.length < 3) return null;

  // Determine index layout: if 4+ td cells, region is at [0]
  const offset = cells.length >= 4 ? 1 : 0;
  const goldType = extractText(cells[offset]);
  const buyCell = cells[offset + 1];
  const sellCell = cells[offset + 2];

  // Skip hex-obfuscated cells
  if (isObfuscated(buyCell) || isObfuscated(sellCell)) return null;

  const bid = parseVNPrice(extractText(buyCell));
  const ask = parseVNPrice(extractText(sellCell));
  if (bid <= 0 || ask <= 0) return null;

  return { goldType, bid, ask };
}

// --- SJC: Scrape gold prices from webgia.com ---

async function crawlSJC(fetchedAt: string): Promise<PriceRecord[]> {
  const html = await fetchWithRetry("https://webgia.com/gia-vang/sjc/");
  const doc = parseHTML(html);
  if (!doc) throw new Error("Failed to parse SJC HTML");

  const rows = getTableRows(doc);
  const records: PriceRecord[] = [];

  for (const row of rows) {
    const parsed = parseWebgiaRow(row);
    if (!parsed) continue;
    const { goldType, bid, ask } = parsed;

    // SJC 9999 gold bar
    if (/SJC\s*(1L|10L|1KG)/i.test(goldType) || /vàng SJC/i.test(goldType)) {
      if (!records.some((r) => r.symbol === "SJC_9999")) {
        records.push({
          symbol: "SJC_9999", price: ask, bid, ask,
          unit: "VND", source: "sjc", fetched_at: fetchedAt,
        });
      }
    }

    // SJC ring / nhẫn SJC 99.99%
    if (/nhẫn.*SJC|nhẫn.*99[,.]99/i.test(goldType)) {
      if (!records.some((r) => r.symbol === "SJC_RING")) {
        records.push({
          symbol: "SJC_RING", price: ask, bid, ask,
          unit: "VND", source: "sjc", fetched_at: fetchedAt,
        });
      }
    }
  }

  if (records.length === 0) throw new Error("SJC prices not found");
  return records;
}

// --- PNJ: Scrape gold prices from webgia.com ---

async function crawlPNJ(fetchedAt: string): Promise<PriceRecord[]> {
  const html = await fetchWithRetry("https://webgia.com/gia-vang/pnj/");
  const doc = parseHTML(html);
  if (!doc) throw new Error("Failed to parse PNJ HTML");

  const rows = getTableRows(doc);

  // Look for row with "PNJ" in gold type column
  for (const row of rows) {
    const parsed = parseWebgiaRow(row);
    if (!parsed) continue;
    if (!/pnj/i.test(parsed.goldType)) continue;

    return [{
      symbol: "PNJ_GOLD", price: parsed.ask, bid: parsed.bid, ask: parsed.ask,
      unit: "VND", source: "pnj", fetched_at: fetchedAt,
    }];
  }

  // Fallback: first row with valid non-obfuscated prices
  for (const row of rows) {
    const parsed = parseWebgiaRow(row);
    if (!parsed) continue;
    return [{
      symbol: "PNJ_GOLD", price: parsed.ask, bid: parsed.bid, ask: parsed.ask,
      unit: "VND", source: "pnj", fetched_at: fetchedAt,
    }];
  }

  throw new Error("PNJ gold price not found");
}

// --- DOJI: Scrape gold prices from webgia.com ---

async function crawlDOJI(fetchedAt: string): Promise<PriceRecord[]> {
  const html = await fetchWithRetry("https://webgia.com/gia-vang/doji/");
  const doc = parseHTML(html);
  if (!doc) throw new Error("Failed to parse DOJI HTML");

  const rows = getTableRows(doc);
  for (const row of rows) {
    const cells = row.querySelectorAll("td");
    if (cells.length < 3) continue;

    const goldType = extractText(cells[0]);
    if (!/sjc|doji/i.test(goldType)) continue;

    // Use last 2 non-obfuscated price columns
    const buyCell = cells[cells.length - 2];
    const sellCell = cells[cells.length - 1];
    if (isObfuscated(buyCell) || isObfuscated(sellCell)) continue;

    const bid = parseVNPrice(extractText(buyCell));
    const ask = parseVNPrice(extractText(sellCell));
    if (bid <= 0 || ask <= 0) continue;

    return [{
      symbol: "DOJI_GOLD", price: ask, bid, ask,
      unit: "VND", source: "doji", fetched_at: fetchedAt,
    }];
  }

  throw new Error("DOJI gold price not found");
}

// --- Main handler ---

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsResponse();

  const authError = verifyCrawlSecret(req);
  if (authError) return authError;

  const fetchedAt = new Date().toISOString();
  const errors: string[] = [];
  const allRecords: PriceRecord[] = [];

  const results = await Promise.allSettled([
    crawlSJC(fetchedAt),
    crawlPNJ(fetchedAt),
    crawlDOJI(fetchedAt),
  ]);

  const labels = ["SJC", "PNJ", "DOJI"];
  results.forEach((result, i) => {
    if (result.status === "fulfilled") {
      allRecords.push(...result.value);
    } else {
      const reason = result.reason instanceof Error ? result.reason.message : String(result.reason);
      console.error(`${labels[i]}: ${reason}`);
      errors.push(`${labels[i]}: ${reason}`);
    }
  });

  if (allRecords.length === 0) {
    return errorResponse("All crawlers failed: " + errors.join("; "), 502);
  }

  try {
    const supabase = createServiceClient();
    const { error: dbError } = await supabase
      .from("prices")
      .upsert(allRecords, { onConflict: "symbol,fetched_at", ignoreDuplicates: true });
    if (dbError) throw dbError;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return errorResponse(`DB insert failed: ${msg}`, 500);
  }

  return jsonResponse({
    inserted: allRecords.length,
    symbols: allRecords.map((r) => r.symbol),
    errors: errors.length ? errors : undefined,
  });
});
