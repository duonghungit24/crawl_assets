// Edge Function: Crawl Vietnamese gasoline/diesel prices from Petrolimex via webgia.com
import { createServiceClient } from "../_shared/supabase-client.ts";
import { jsonResponse, errorResponse, corsResponse } from "../_shared/response-helpers.ts";
import {
  parseHTML,
  extractText,
  parseVNPrice,
  fetchWithRetry,
  verifyCrawlSecret,
} from "../_shared/html-parser.ts";

// Match specific product variants from Petrolimex table
// RON 95-III (not RON 95-V), E5 RON 92-II, DO 0,001S-V (low-sulfur diesel)
const FUEL_MAPPINGS: Array<{ pattern: RegExp; symbol: string }> = [
  { pattern: /RON\s*95.*III/i, symbol: "RON95" },
  { pattern: /E5\s*RON\s*92/i, symbol: "RON98" },
  { pattern: /DO\s*0[,.]001/i, symbol: "DIESEL" },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsResponse();

  const authError = verifyCrawlSecret(req);
  if (authError) return authError;

  const fetchedAt = new Date().toISOString();

  try {
    const html = await fetchWithRetry(
      "https://webgia.com/gia-xang-dau/petrolimex/"
    );
    const doc = parseHTML(html);
    if (!doc) throw new Error("Failed to parse Petrolimex HTML");

    // Try multiple selector strategies for table rows
    const selectors = [
      "table.table-radius tbody tr",
      "table.table-radius tr",
      "table tbody tr",
      "table tr",
    ];
    let dataRows: Element[] = [];
    for (const sel of selectors) {
      const rows = [...(doc.querySelectorAll(sel) ?? [])];
      // Fuel table: product in <th>, prices in <td> — rows may have only 1-2 td cells
      dataRows = rows.filter((r) => r.querySelectorAll("td").length >= 1);
      if (dataRows.length > 0) break;
    }

    // Table: Sản phẩm | Vùng 1 | Vùng 2
    const records: Array<{
      symbol: string;
      price: number;
      bid: number | null;
      ask: number | null;
      unit: string;
      source: string;
      fetched_at: string;
    }> = [];
    const matched = new Set<string>();

    for (const row of dataRows) {
      // Petrolimex table: product name is in <th>, prices in <td>
      const th = row.querySelector("th");
      const cells = row.querySelectorAll("td");
      // Need at least product name (th) and 1 price cell (td)
      const product = th ? extractText(th) : extractText(cells[0]);
      const priceIdx = th ? 0 : 1;
      if (cells.length < priceIdx + 1) continue;

      const priceVung1 = parseVNPrice(extractText(cells[priceIdx]));
      if (priceVung1 <= 0) continue;

      for (const { pattern, symbol } of FUEL_MAPPINGS) {
        if (matched.has(symbol)) continue;
        if (!pattern.test(product)) continue;

        records.push({
          symbol,
          price: priceVung1,
          bid: null,
          ask: null,
          unit: "VND",
          source: "petrolimex",
          fetched_at: fetchedAt,
        });
        matched.add(symbol);
        break;
      }
    }

    if (records.length === 0) {
      throw new Error("No fuel prices found in HTML table");
    }

    const supabase = createServiceClient();
    const { error: dbError } = await supabase
      .from("prices")
      .upsert(records, { onConflict: "symbol,fetched_at", ignoreDuplicates: true });
    if (dbError) throw dbError;

    return jsonResponse({
      inserted: records.length,
      symbols: records.map((r) => r.symbol),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`crawl-gasoline-vn failed: ${msg}`);
    return errorResponse(msg, 502);
  }
});
