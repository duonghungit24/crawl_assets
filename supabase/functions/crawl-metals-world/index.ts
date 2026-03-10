// Edge Function: Crawl international gold (XAU) and silver (XAG) prices from Yahoo Finance
import { createServiceClient } from "../_shared/supabase-client.ts";
import { jsonResponse, errorResponse, corsResponse } from "../_shared/response-helpers.ts";
import { verifyCrawlSecret } from "../_shared/crawl-auth.ts";
import { fetchYahooPrice } from "../_shared/yahoo-finance.ts";

const METALS: Array<{ ticker: string; symbol: string }> = [
  { ticker: "GC=F", symbol: "XAU_USD" },
  { ticker: "SI=F", symbol: "XAG_USD" },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsResponse();

  const authError = verifyCrawlSecret(req);
  if (authError) return authError;

  const fetchedAt = new Date().toISOString();
  const errors: string[] = [];
  const records: Array<{
    symbol: string;
    price: number;
    bid: number | null;
    ask: number | null;
    unit: string;
    source: string;
    fetched_at: string;
  }> = [];

  const results = await Promise.allSettled(
    METALS.map((m) => fetchYahooPrice(m.ticker)),
  );

  results.forEach((result, i) => {
    const { symbol } = METALS[i];
    if (result.status === "fulfilled") {
      records.push({
        symbol,
        price: result.value,
        bid: null,
        ask: null,
        unit: "USD",
        source: "yahoo",
        fetched_at: fetchedAt,
      });
    } else {
      const reason = result.reason instanceof Error
        ? result.reason.message
        : String(result.reason);
      console.error(`${symbol}: ${reason}`);
      errors.push(`${symbol}: ${reason}`);
    }
  });

  if (records.length === 0) {
    return errorResponse("All metals fetches failed: " + errors.join("; "), 502);
  }

  try {
    const supabase = createServiceClient();
    const { error: dbError } = await supabase
      .from("prices")
      .upsert(records, { onConflict: "symbol,fetched_at", ignoreDuplicates: true });
    if (dbError) throw dbError;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return errorResponse(`DB insert failed: ${msg}`, 500);
  }

  return jsonResponse({
    inserted: records.length,
    symbols: records.map((r) => r.symbol),
    errors: errors.length ? errors : undefined,
  });
});
