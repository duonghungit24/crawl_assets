// Shared Yahoo Finance chart API client for world commodity crawlers
// Uses the public v8 chart API endpoint — no API key needed

const CHART_API_BASE = "https://query2.finance.yahoo.com/v8/finance/chart";

/** Fetch latest price for a Yahoo Finance ticker via the chart JSON API (1 retry, 2s delay) */
export async function fetchYahooPrice(ticker: string): Promise<number> {
  const url = `${CHART_API_BASE}/${ticker}?interval=1d&range=1d`;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15_000);

      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`Yahoo chart API HTTP ${res.status} for ${ticker}`);
      }

      const json = await res.json();
      const price = json?.chart?.result?.[0]?.meta?.regularMarketPrice;

      if (typeof price !== "number" || !Number.isFinite(price) || price <= 0) {
        console.error(`Yahoo chart API unexpected response for ${ticker}:`, JSON.stringify(json).slice(0, 300));
        throw new Error(`Invalid price from Yahoo chart API for ${ticker}`);
      }

      return price;
    } catch (err) {
      if (attempt === 0) {
        console.warn(`Yahoo fetch attempt 1 failed for ${ticker}: ${err}. Retrying...`);
        await new Promise((r) => setTimeout(r, 2000));
      } else {
        throw err;
      }
    }
  }
  throw new Error("Unreachable");
}
