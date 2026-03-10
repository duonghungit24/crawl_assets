// Edge Function: Crawl international gasoline price (RBOB) from Yahoo Finance
import { createServiceClient } from "../_shared/supabase-client.ts";
import { jsonResponse, errorResponse, corsResponse } from "../_shared/response-helpers.ts";
import { verifyCrawlSecret } from "../_shared/crawl-auth.ts";
import { fetchYahooPrice } from "../_shared/yahoo-finance.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsResponse();

  const authError = verifyCrawlSecret(req);
  if (authError) return authError;

  const fetchedAt = new Date().toISOString();

  let price: number;
  try {
    price = await fetchYahooPrice("RB=F");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`crawl-gasoline-world fetch failed: ${msg}`);
    return errorResponse(msg, 502);
  }

  try {
    const record = {
      symbol: "RBOB_USD",
      price,
      bid: null,
      ask: null,
      unit: "USD",
      source: "yahoo",
      fetched_at: fetchedAt,
    };

    const supabase = createServiceClient();
    const { error: dbError } = await supabase
      .from("prices")
      .upsert([record], { onConflict: "symbol,fetched_at", ignoreDuplicates: true });
    if (dbError) throw dbError;

    return jsonResponse({
      inserted: 1,
      symbols: ["RBOB_USD"],
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return errorResponse(`DB insert failed: ${msg}`, 500);
  }
});
