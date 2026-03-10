// Edge Function: Crawl Vietnamese silver prices
// NOTE: No reliable VN silver price source found via HTML scraping.
// Vietnamese aggregators (webgia, tygia) only track gold, not silver.
// This function is deployed as a placeholder — will be activated when
// a reliable source is identified. PNJ_SILVER can also be derived
// from XAG_USD (world silver) converted to VND in Phase 04.
import { jsonResponse, corsResponse } from "../_shared/response-helpers.ts";
import { verifyCrawlSecret } from "../_shared/html-parser.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsResponse();

  const authError = verifyCrawlSecret(req);
  if (authError) return authError;

  // No reliable VN silver source available yet
  console.warn("crawl-silver-vn: no reliable VN silver price source configured");
  return jsonResponse({
    inserted: 0,
    symbols: [],
    message: "No VN silver price source available. Use XAG_USD from world crawlers.",
  });
});
