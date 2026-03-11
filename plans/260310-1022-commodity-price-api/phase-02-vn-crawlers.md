# Phase 02: Vietnamese Crawlers

## Context Links
- [Plan Overview](plan.md)
- [Phase 01: Setup](phase-01-setup-and-db-schema.md)
- SJC: https://sjc.com.vn
- PNJ: https://pnj.com.vn
- DOJI: https://doji.vn
- Petrolimex: https://petrolimex.com.vn

## Overview
- **Priority**: P1
- **Status**: done
- **Effort**: 3h
- **Depends on**: Phase 01
- Build Edge Functions to scrape Vietnamese gold, silver, and gasoline prices from HTML pages.

## Key Insights
- VN sites serve server-rendered HTML — no JS rendering needed, simple fetch + parse
- deno-dom is Deno-native HTML parser (no npm compat layer needed)
- VN gold sites show buy/sell prices in tables — use bid/ask columns
- Petrolimex publishes prices in a table, updates ~2x/month (not hourly)
- Sites may change HTML structure — selectors need to be easily configurable

## Requirements

### Functional
- Crawl SJC gold prices (SJC_9999, SJC_RING): bid + ask in VND
- Crawl PNJ gold prices (PNJ_GOLD) + silver (PNJ_SILVER): bid + ask in VND
- Crawl DOJI gold prices (DOJI_GOLD): bid + ask in VND
- Crawl Petrolimex gasoline (RON95, RON98, DIESEL): single price in VND
- All crawlers insert into `prices` table via service_role client
- Auth check: verify `CRAWL_SECRET` header before executing

### Non-Functional
- Timeout: 30s max per crawl function
- Retry: on fetch failure, retry once after 2s
- Dedup: skip insert if same symbol+fetched_at already exists (UNIQUE constraint handles this)
- Log errors to console (Supabase logs capture Edge Function stdout)

## Architecture

### Edge Function Pattern
Each crawler follows same pattern:
```
1. Verify CRAWL_SECRET header
2. Fetch source HTML
3. Parse HTML with deno-dom
4. Extract prices using CSS selectors
5. Map to { symbol, price, bid, ask, unit, source } records
6. Batch insert into prices table
7. Return { inserted: N, errors: [...] }
```

### Shared HTML Parser Module
```typescript
// supabase/functions/_shared/html-parser.ts
import { DOMParser } from "https://deno.land/x/deno_dom/deno-dom-wasm.ts";

export function parseHTML(html: string) {
  return new DOMParser().parseFromString(html, "text/html");
}

export function extractText(el: Element | null): string {
  return el?.textContent?.trim() ?? "";
}

export function parseVNPrice(text: string): number {
  // "123.456.789" -> 123456789, or "123,456" -> 123456
  return Number(text.replace(/\./g, "").replace(/,/g, ""));
}
```

## Related Code Files
- **Create**: `supabase/functions/_shared/html-parser.ts`
- **Create**: `supabase/functions/crawl-gold-vn/index.ts`
- **Create**: `supabase/functions/crawl-silver-vn/index.ts`
- **Create**: `supabase/functions/crawl-gasoline-vn/index.ts`
- **Update**: `supabase/functions/_shared/response-helpers.ts` (added x-crawl-secret to CORS headers)

## Implementation Steps

### Step 1: Create shared HTML parser
- Create `supabase/functions/_shared/html-parser.ts` with `parseHTML`, `extractText`, `parseVNPrice` helpers

### Step 2: Create `crawl-gold-vn` Edge Function
1. Create `supabase/functions/crawl-gold-vn/index.ts`
2. Verify `CRAWL_SECRET` header
3. Fetch SJC page, parse HTML, extract SJC 9999 and SJC ring buy/sell prices
4. Fetch PNJ page, parse HTML, extract gold buy/sell
5. Fetch DOJI page, parse HTML, extract gold buy/sell
6. Insert all records:
   ```typescript
   const records = [
     { symbol: "SJC_9999", bid: sjcBuy, ask: sjcSell, price: sjcSell, unit: "VND", source: "sjc" },
     { symbol: "SJC_RING", bid: ringBuy, ask: ringSell, price: ringSell, unit: "VND", source: "sjc" },
     { symbol: "PNJ_GOLD", bid: pnjBuy, ask: pnjSell, price: pnjSell, unit: "VND", source: "pnj" },
     { symbol: "DOJI_GOLD", bid: dojiBuy, ask: dojiSell, price: dojiSell, unit: "VND", source: "doji" },
   ];
   ```
7. Return summary JSON

### Step 3: Create `crawl-silver-vn` Edge Function
1. Create `supabase/functions/crawl-silver-vn/index.ts`
2. Fetch PNJ silver page, parse, extract buy/sell
3. Insert `PNJ_SILVER` record
4. Return summary

### Step 4: Create `crawl-gasoline-vn` Edge Function
1. Create `supabase/functions/crawl-gasoline-vn/index.ts`
2. Fetch Petrolimex price page
3. Parse table rows, extract RON95-III, E5 RON92, Diesel prices
4. Insert records for RON95, RON98, DIESEL
5. Return summary

### Step 5: Deploy and test
1. `supabase functions deploy crawl-gold-vn`
2. `supabase functions deploy crawl-silver-vn`
3. `supabase functions deploy crawl-gasoline-vn`
4. Test each via curl with CRAWL_SECRET header

## Todo List
- [x] Create shared HTML parser module
- [x] Implement crawl-gold-vn (SJC, PNJ, DOJI)
- [x] Implement crawl-silver-vn (placeholder — no VN silver source available)
- [x] Implement crawl-gasoline-vn (Petrolimex)
- [x] Deploy all VN crawlers
- [x] Test each crawler manually via curl
- [x] Verify data appears in prices table (7 symbols confirmed)

## Success Criteria
- Each function returns 200 with `{ inserted: N }` on success
- Prices visible in `prices` table via PostgREST
- Duplicate calls don't create duplicate rows (UNIQUE constraint)
- Unauthorized calls (no CRAWL_SECRET) return 401

## Risk Assessment
| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| HTML structure changes on source sites | High | Use descriptive CSS selectors; log parse failures; monitor |
| Site blocks Supabase Edge Function IPs | Medium | Add User-Agent header; if blocked, consider proxy |
| VN price format variations (commas vs dots) | Medium | parseVNPrice handles both formats |
| deno-dom WASM import size (~2MB) | Low | Supabase Edge Functions support WASM; cold start may be slower |

## Security Considerations
- CRAWL_SECRET checked before any scraping
- No user input in selectors — all hardcoded
- Service role key only used server-side in Edge Functions
