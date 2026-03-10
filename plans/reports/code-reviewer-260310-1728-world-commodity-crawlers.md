# Code Review: World Commodity Crawlers (Yahoo Finance)

**Score: 8.5/10**

## Scope
- Files: 6 (3 new functions, 2 new shared modules, 1 modified)
- LOC: ~220 total
- Focus: New world commodity price crawlers using Yahoo Finance

## Overall Assessment

Clean, well-structured implementation. Good extraction of shared modules (`yahoo-finance.ts`, `crawl-auth.ts`). Consistent patterns across all three crawlers. Backward compatibility preserved via re-export in `html-parser.ts`. Security fundamentals solid.

## Critical Issues

None.

## High Priority

### 1. Yahoo Finance API stability risk (Medium-High)
- `query2.finance.yahoo.com/v8/finance/chart` is an undocumented/unofficial endpoint
- Yahoo has historically blocked scrapers and changed endpoints without notice
- No retry logic in `fetchYahooPrice` (unlike `fetchWithRetry` in html-parser.ts)
- **Recommendation**: Add 1 retry with delay, matching the VN crawler pattern. Also consider a fallback URL (`query1.finance.yahoo.com`).

### 2. Abort signal not cleared on JSON parse failure
- Line 19 clears timeout but if `res.json()` hangs or throws (line 25), the abort controller is already cleared -- no timeout protection for body parsing
- **Low likelihood** but worth noting for robustness

## Medium Priority

### 3. DRY violation: crawl-oil-world and crawl-metals-world are nearly identical
- Both files share the exact same structure: ticker array, Promise.allSettled, record assembly, DB upsert
- Only differ in: ticker list, error message prefix, response shape
- **Recommendation**: Consider a shared `crawlMultipleTickers(tickers, req)` helper. Not blocking -- 3 files is manageable, but if more commodities are added, refactor.

### 4. Inconsistent error status codes
- `crawl-gasoline-world`: returns 502 for all errors (fetch + DB)
- `crawl-oil-world` / `crawl-metals-world`: returns 502 for fetch failures, 500 for DB errors
- **Recommendation**: Standardize. 502 (Bad Gateway) is correct for upstream fetch failures. 500 for DB errors. Gasoline should distinguish.

### 5. Record type duplication
- The record type `{ symbol, price, bid, ask, unit, source, fetched_at }` is inline-defined in both oil and metals functions
- **Recommendation**: Extract a `PriceRecord` type to the shared module or a types file

## Low Priority

### 6. User-Agent string is hardcoded in two places
- `yahoo-finance.ts` line 15 and `html-parser.ts` line 42 both hardcode similar UA strings
- Minor -- extract to a shared constant if more clients are added

### 7. `deno.land/std` import without version pin
- `crawl-auth.ts` line 2: `https://deno.land/std/crypto/timing_safe_equal.ts` has no version
- Could break on std library updates
- **Recommendation**: Pin version, e.g., `https://deno.land/std@0.224.0/crypto/timing_safe_equal.ts`

## Security Assessment

| Check | Status |
|-------|--------|
| Auth (CRAWL_SECRET) | Pass -- constant-time comparison, checked before any logic |
| Secret leakage | Pass -- no secrets in responses or logs |
| Input validation | Pass -- ticker list is hardcoded, not user-supplied |
| CORS | Pass -- OPTIONS handled, headers set |
| Error messages | Pass -- no internal details leaked to client |
| Injection | N/A -- no user input flows to queries |

## Positive Observations

- Clean module extraction: `crawl-auth.ts` properly separates auth from HTML parsing, allowing world crawlers to avoid importing deno-dom
- `Promise.allSettled` for multi-ticker fetches -- partial success handled well
- Price validation (`isFinite`, `> 0`) catches NaN/null/negative edge cases
- Abort controller timeout on fetch -- good practice
- Re-export pattern in `html-parser.ts` preserves backward compatibility with zero changes to VN crawlers
- Consistent use of shared helpers (`jsonResponse`, `errorResponse`, `corsResponse`, `createServiceClient`)

## Recommended Actions (Priority Order)

1. Pin `deno.land/std` version in `crawl-auth.ts` import
2. Add retry logic to `fetchYahooPrice` (1 retry, 2s delay)
3. Fix gasoline-world error code to distinguish fetch vs DB failures
4. Extract shared `PriceRecord` type (optional, do when adding more crawlers)
5. Consider shared multi-ticker crawl helper (optional, do when >3 similar functions)

## Unresolved Questions

- Is there a cron schedule already configured for these world crawlers in GitHub Actions?
- Should we add monitoring/alerting for when Yahoo Finance endpoint changes or returns errors consistently?
