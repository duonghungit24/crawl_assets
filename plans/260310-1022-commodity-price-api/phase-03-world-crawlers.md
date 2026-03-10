# Phase 03: World Crawlers

## Context Links
- [Plan Overview](plan.md)
- [Phase 01: Setup](phase-01-setup-and-db-schema.md)
- Yahoo Finance Chart API: https://query2.finance.yahoo.com/v8/finance/chart/

## Overview
- **Priority**: P1
- **Status**: done
- **Effort**: 2.5h
- **Depends on**: Phase 01
- Build Edge Functions for international commodity prices using Yahoo Finance chart API (JSON, no API key needed).

## Key Insights
- Yahoo Finance HTML pages block server-side requests (Supabase Edge Functions)
- Yahoo Finance v8 chart API (`query2.finance.yahoo.com`) works from server-side — returns JSON
- No API key needed — public endpoint, no rate limiting observed
- EIA API requires registration — eliminated in favor of Yahoo Finance for all world prices
- Extracted `verifyCrawlSecret` into `_shared/crawl-auth.ts` to avoid deno-dom dependency in world crawlers

## Architecture

### Yahoo Finance Chart API
```
GET https://query2.finance.yahoo.com/v8/finance/chart/{TICKER}?interval=1d&range=1d
```
Response: `{ chart: { result: [{ meta: { regularMarketPrice: 87.49 } }] } }`

### Tickers
| Symbol | Yahoo Ticker | Description |
|--------|-------------|-------------|
| WTI_USD | CL=F | WTI Crude Oil Futures |
| BRENT_USD | BZ=F | Brent Crude Oil Futures |
| RBOB_USD | RB=F | RBOB Gasoline Futures |
| XAU_USD | GC=F | Gold Futures |
| XAG_USD | SI=F | Silver Futures |

## Related Code Files
- **Created**: `supabase/functions/_shared/crawl-auth.ts` (extracted auth)
- **Created**: `supabase/functions/_shared/yahoo-finance.ts` (shared Yahoo client)
- **Created**: `supabase/functions/crawl-oil-world/index.ts`
- **Created**: `supabase/functions/crawl-gasoline-world/index.ts`
- **Created**: `supabase/functions/crawl-metals-world/index.ts`
- **Modified**: `supabase/functions/_shared/html-parser.ts` (re-exports from crawl-auth.ts)

## Todo List
- [x] Implement crawl-oil-world (Yahoo: WTI + Brent)
- [x] Implement crawl-gasoline-world (Yahoo: RBOB)
- [x] Implement crawl-metals-world (Yahoo: XAU + XAG)
- [x] Extract verifyCrawlSecret into crawl-auth.ts (avoid deno-dom dep)
- [x] Create shared yahoo-finance.ts module
- [x] Deploy all world crawlers
- [x] Test each crawler manually
- [x] Verify USD prices in database

## Test Results
```
crawl-oil-world:      {"inserted":2,"symbols":["WTI_USD","BRENT_USD"]}
crawl-gasoline-world: {"inserted":1,"symbols":["RBOB_USD"]}
crawl-metals-world:   {"inserted":2,"symbols":["XAU_USD","XAG_USD"]}
```

Database verified: WTI=$88.39, BRENT=$87.51, RBOB=$2.589, XAU=$5191.20, XAG=$89.215

## Success Criteria
- [x] All crawlers return correct prices matching Yahoo Finance
- [x] All records have unit="USD" and source="yahoo"
- [x] UNIQUE constraint prevents duplicate entries
- [x] VN crawlers unaffected by html-parser.ts refactoring

## Risk Assessment
| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Yahoo chart API blocked/deprecated | Low | Fallback: fawazahmed0 currency API (CDN) for metals, scrape webgia for oil |
| Yahoo rate limiting | Low | Only 5 requests per cron run; well within limits |

## Security Considerations
- No API keys needed — zero secrets for world crawlers
- CRAWL_SECRET verified before execution via constant-time comparison
- No user-controlled input in API URLs
