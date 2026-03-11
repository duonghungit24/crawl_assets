# Code Review: Phase 02 - Vietnamese Crawlers

## Scope
- **Files**: 4 (html-parser.ts, crawl-gold-vn, crawl-silver-vn, crawl-gasoline-vn)
- **LOC**: ~275 total
- **Context files**: supabase-client.ts, response-helpers.ts, prices table migration

## Overall Assessment

Solid implementation. Good DRY compliance with shared html-parser module. Parallel crawling in gold function is well done. Several issues found ranging from a **critical** symbol mislabel bug to medium-priority security and edge case concerns.

---

## Critical Issues

### 1. WRONG SYMBOL: E5 RON 92 mapped to `RON98`
**File**: `supabase/functions/crawl-gasoline-vn/index.ts`, line 17

```typescript
{ pattern: /E5\s*RON\s*92/i, symbol: "RON98" },
```

E5 RON 92 is a **lower-grade** fuel (92 octane). Mapping it to `RON98` is factually incorrect. RON98 would be a 98-octane product. Petrolimex does not appear to sell RON 98 on the scraped page. Either:
- (a) Rename DB symbol to `E5_RON92` (requires migration + CHECK constraint update), or
- (b) If `RON98` is intentionally used as a generic "second gasoline" bucket, add a comment explaining the deliberate mismatch.

**Impact**: Consumers of the API will receive RON 92 prices labeled as RON 98 -- misleading data.

---

## High Priority

### 2. CORS does not allow `x-crawl-secret` header
**File**: `supabase/functions/_shared/response-helpers.ts`, line 5

```typescript
"Access-Control-Allow-Headers": "authorization, content-type",
```

The `verifyCrawlSecret()` function checks `req.headers.get("x-crawl-secret")`, but this header is **not listed** in `Access-Control-Allow-Headers`. Browser-based callers sending `x-crawl-secret` will have it stripped by CORS preflight. Two options:
- Add `x-crawl-secret` to `Access-Control-Allow-Headers`
- If crawlers are only called server-to-server (cron), CORS is irrelevant -- but then document this assumption

**Note**: The `verifyCrawlSecret` function also falls back to `Authorization: Bearer <token>`, which IS allowed by CORS. So this is not blocking, but the `x-crawl-secret` path silently fails for browser callers.

### 3. Timing-unsafe secret comparison
**File**: `supabase/functions/_shared/html-parser.ts`, line 62

```typescript
if (!secret || provided !== secret) {
```

String `!==` is vulnerable to timing attacks. Use a constant-time comparison. In Deno:

```typescript
import { timingSafeEqual } from "https://deno.land/std/crypto/timing_safe_equal.ts";

const encoder = new TextEncoder();
const isValid = secret && provided &&
  timingSafeEqual(encoder.encode(provided), encoder.encode(secret));
```

**Severity**: Medium-High for an API that controls write access to the DB. Practical exploitability is low (requires many requests), but it's a best-practice violation.

### 4. SJC XML parsed with HTML parser -- may silently misparse
**File**: `supabase/functions/crawl-gold-vn/index.ts`, line 27

```typescript
const xml = await fetchWithRetry(url);
const doc = parseHTML(xml);  // parseHTML uses "text/html" mode
```

`deno-dom` with `text/html` will case-fold tag names and may not handle self-closing XML tags (`<item ... />`) correctly. The SJC XML uses `<item type="..." buy="..." sell="..." />` which is a self-closing tag. In HTML5 parsing mode, `<item />` is treated as an opening tag, not self-closing.

**Recommendation**: Test thoroughly. If `querySelectorAll("item")` returns results, it works. If it fails silently, add an `application/xml` parse path:
```typescript
export function parseXML(xml: string) {
  return new DOMParser().parseFromString(xml, "application/xml");
}
```

### 5. SJC prices may be 0 due to Number() on formatted strings
**File**: `supabase/functions/crawl-gold-vn/index.ts`, lines 38-39

```typescript
const buy = Number(buyRaw) * 1000;
const sell = Number(sellRaw) * 1000;
```

SJC XML buy/sell attributes may contain thousand-separator dots (e.g., `"95.500"`). `Number("95.500")` = 95.5, then `* 1000` = 95500. This happens to work if the value is like `"95.500"` (which is 95,500 VND thousands = 95,500,000 VND). However, if the XML format is `"95500"` (no dots), this also works.

**Risk**: If format changes to use dots differently (e.g., `"95.500.000"`), `Number()` returns NaN, price becomes NaN, and `!buy` catches it. Acceptable but fragile -- consider using `parseVNPrice()` + manual `* 1000` for consistency, or at minimum add a comment documenting the expected XML format.

---

## Medium Priority

### 6. Silver crawler: redundant condition on line 36
**File**: `supabase/functions/crawl-silver-vn/index.ts`, line 36

```typescript
if (!/bac|silver|pnj/i.test(silverType) && cells.length < 3) continue;
```

The regex uses `bac` but the Vietnamese word is `bạc` (with diacritics). The regex won't match the actual text. The `cells.length < 3` second condition is always false because line 32 already ensures `cells.length >= 4`. So this condition either matches the regex or does nothing -- it never skips rows based on keyword mismatch alone.

**Fix**: Change to `!/bạc|silver|pnj/i.test(silverType)` and drop the `&& cells.length < 3`:
```typescript
if (!/bạc|silver|pnj/i.test(silverType)) continue;
```

Or keep the fallback logic on lines 44-50 as the safety net and just accept the first valid row.

### 7. `verifyCrawlSecret` returns 401 when CRAWL_SECRET env var is unset
**File**: `supabase/functions/_shared/html-parser.ts`, line 62

```typescript
if (!secret || provided !== secret)
```

If `CRAWL_SECRET` is not configured in Supabase env, ALL requests are rejected. This is safe (fail-closed), but should log a warning to help operators debug deployment issues:

```typescript
if (!secret) {
  console.error("CRAWL_SECRET env var not set — all requests will be rejected");
}
```

### 8. Error messages leak internal details
**File**: `supabase/functions/crawl-gold-vn/index.ts`, line 198

```typescript
return errorResponse(`DB insert failed: ${err}`, 500);
```

The `err` object may contain DB connection strings, table names, constraint details. For a cron-invoked function this is low risk, but best practice is to log full error server-side and return a generic message:

```typescript
console.error("DB insert failed:", err);
return errorResponse("Failed to save prices", 500);
```

Same applies to silver (line 72) and gasoline (line 89) crawlers returning `${err}` directly.

### 9. No deduplication handling on DB constraint violation
The `prices` table has `UNIQUE(symbol, fetched_at)`. If a crawler runs twice in the same second, the insert will fail with a unique constraint error. The code treats this as a generic error (500/502).

**Fix**: Either use `.upsert()` instead of `.insert()`, or check the error code for unique violation and return a 200 with "already exists" message.

### 10. Inconsistent PriceRecord type usage
Gold crawler defines `PriceRecord` interface (lines 12-20). Silver and gasoline crawlers use inline object types. Should either:
- Export `PriceRecord` from html-parser.ts as a shared type, or
- Define it in each file consistently

---

## Low Priority

### 11. `fetchWithRetry` logs URL in warning -- minor info leak in logs
Line 45: `console.warn(... for ${url}: ${err} ...)` -- acceptable for server logs but be aware scraped URLs are visible in Supabase log viewer.

### 12. `parseVNPrice` returns 0 for unparseable text
This means `!bid` and `!ask` checks work to detect failures, but 0 is also a valid price theoretically (free fuel?). Returning `null` or `NaN` would be more semantically correct, though practically commodity prices are never 0.

### 13. Gold crawler dedup keeps first match per symbol
Lines 71-76: If SJC publishes different prices for different cities (HN vs HCM), only the first city's price is kept. This may or may not be intentional. Add a comment if deliberate.

---

## Edge Cases Found

| Edge Case | Current Behavior | Severity |
|-----------|-----------------|----------|
| Empty table (0 rows) | Gold: returns 0 records, triggers "All crawlers failed" if all 3 fail. Silver/gasoline: throws. | OK |
| Price = "---" or "-" | `parseVNPrice` returns 0, row skipped via `!bid` check | OK |
| Site returns 403/429 | `fetchWithRetry` retries once, then throws | OK |
| HTML structure changes | Throws "row not found" -- clear error | OK |
| Concurrent invocations | UNIQUE constraint violation returns 500 | Should handle (see #9) |
| SJC XML has no `<item>` tags | Returns empty array, partial success | OK |
| VN price with comma decimals ("27,640") | `parseVNPrice` strips commas -- parses as 27640 | OK |
| Bearer token with extra spaces | `replace("Bearer ", "")` only strips first occurrence | OK but fragile |

---

## Positive Observations

- Good use of `Promise.allSettled` for partial-success semantics in gold crawler
- Shared utilities module is well-factored (DRY)
- Retry with timeout on fetch is production-ready
- `verifyCrawlSecret` fails closed when secret is missing
- CSS selectors match the research report findings
- Deduplication set in gold crawler prevents multi-city duplicates
- Fuel mapping pattern with `matched` set prevents double-matching

---

## Recommended Actions (Priority Order)

1. **Fix RON98 symbol mislabel** -- critical data accuracy issue
2. **Fix silver regex** -- `bac` should be `bạc` (diacritics)
3. **Add `x-crawl-secret` to CORS allowed headers** or document server-only usage
4. **Use timing-safe comparison** for CRAWL_SECRET
5. **Test SJC XML parsing** with deno-dom HTML mode to confirm `<item/>` works
6. **Handle UNIQUE constraint violations** gracefully (upsert or catch)
7. **Sanitize error messages** in responses (log details server-side only)
8. **Extract shared PriceRecord type** to html-parser.ts
9. **Add CRAWL_SECRET-missing warning log**

---

## Metrics
- Type Coverage: ~85% (inline types used, one explicit interface in gold crawler)
- Test Coverage: 0% (no tests yet -- expected per phase plan)
- Linting Issues: Not run (Deno lint not executed in this review)

## Unresolved Questions
1. Is `RON98` intentionally mapped to E5 RON 92, or is this a bug? If intentional, the symbol name is misleading.
2. Should crawlers use `.upsert()` to be idempotent, or is the current fail-on-duplicate behavior desired?
3. For SJC gold, which city's price should be canonical (currently first match)?
