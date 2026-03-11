# Supabase Edge Functions Validation Report
## Phase 02: Vietnamese Crawlers (Gold, Silver, Gasoline)

**Report Date:** 2026-03-10 | **Time:** 13:17
**Validator:** QA Tester | **Status:** COMPLETE
**Files Analyzed:** 6 (3 crawlers + 3 shared modules + 1 migration)

---

## Executive Summary

All 4 Edge Functions analyzed for Phase 02 (Vietnamese Crawlers) pass **static validation** with **3 CRITICAL ISSUES** and **7 MEDIUM ISSUES** identified. Functions are structurally sound but require fixes before production deployment.

**Verdict:** ❌ NOT READY FOR MERGE — Critical issues must be fixed.

---

## Files Analyzed

| File | Type | Lines | Status |
|------|------|-------|--------|
| `supabase/functions/_shared/html-parser.ts` | Shared Module | 70 | ✅ Pass |
| `supabase/functions/_shared/supabase-client.ts` | Shared Module | 17 | ✅ Pass |
| `supabase/functions/_shared/response-helpers.ts` | Shared Module | 25 | ✅ Pass |
| `supabase/functions/crawl-gold-vn/index.ts` | Edge Function | 207 | ⚠️ Issues |
| `supabase/functions/crawl-silver-vn/index.ts` | Edge Function | 75 | ⚠️ Issues |
| `supabase/functions/crawl-gasoline-vn/index.ts` | Edge Function | 92 | ⚠️ Issues |
| `supabase/migrations/20260310000001_create_prices_table.sql` | Migration | 38 | ✅ Pass |

---

## Syntax & Import Validation

### ✅ PASS: Import Paths
All imports use correct Deno/Supabase Edge Functions patterns:
- Relative imports with `.ts` extension: `"../_shared/html-parser.ts"` ✅
- ESM imports for dependencies: `"https://esm.sh/@supabase/supabase-js@2"` ✅
- Deno land imports: `"https://deno.land/x/deno_dom/deno-dom-wasm.ts"` ✅

### ✅ PASS: TypeScript Syntax
- All TypeScript code is syntactically valid
- Type annotations properly defined
- Interface definitions correct
- No obvious compilation errors detected

### ✅ PASS: Deno.serve() Pattern
All functions correctly use Deno.serve pattern:
```typescript
Deno.serve(async (req) => { ... })
```

---

## Database Schema Validation

### ✅ PASS: Column Names Match Migration

Migration defines table with columns:
```sql
id, symbol, price, bid, ask, unit, source, fetched_at, created_at
```

All crawlers insert records with matching columns:
- **crawl-gold-vn**: symbol, price, bid, ask, unit, source, fetched_at ✅
- **crawl-silver-vn**: symbol, price, bid, ask, unit, source, fetched_at ✅
- **crawl-gasoline-vn**: symbol, price, bid, ask, unit, source, fetched_at ✅

### ✅ PASS: Symbol Values Match CHECK Constraint
Migration defines allowed symbols:
```sql
symbol IN ('SJC_9999', 'SJC_RING', 'PNJ_GOLD', 'DOJI_GOLD',
           'PNJ_SILVER', 'RON95', 'RON98', 'DIESEL',
           'XAU_USD', 'XAG_USD', 'WTI_USD', 'BRENT_USD', 'RBOB_USD')
```

**Crawler symbols used:**
- crawl-gold-vn: `SJC_9999`, `SJC_RING`, `PNJ_GOLD`, `DOJI_GOLD` ✅
- crawl-silver-vn: `PNJ_SILVER` ✅
- crawl-gasoline-vn: `RON95`, `RON98`, `DIESEL` ✅

All symbols are valid per CHECK constraint.

### ✅ PASS: Unit Values
Migration allows: `'VND'`, `'USD'`
- crawl-gold-vn: uses `"VND"` ✅
- crawl-silver-vn: uses `"VND"` ✅
- crawl-gasoline-vn: uses `"VND"` ✅

---

## Critical Issues (3)

### 🔴 CRITICAL-1: crawl-silver-vn Line 36 — Logic Error in Condition

**File:** `supabase/functions/crawl-silver-vn/index.ts`
**Location:** Lines 36
**Severity:** CRITICAL

```typescript
36:  if (!/bạc|silver|pnj/i.test(silverType) && cells.length < 3) continue;
```

**Problem:** Logical operator is wrong. Current condition:
- `NOT match keywords AND cells.length < 3` → only skips if BOTH true
- Should be: `NOT match keywords OR cells.length < 3`

**Impact:**
- Parser will attempt to extract price from rows that don't contain silver keywords
- Risk of extracting wrong price from header row or empty rows
- Potential for returning zero prices (parseVNPrice returns 0 on failure)

**Fix:**
```typescript
if ((!/bạc|silver|pnj/i.test(silverType)) || (cells.length < 3)) continue;
// OR better: change logic to explicit positive match
if (/bạc|silver|pnj/i.test(silverType) || cells.length >= 3) {
  // process
}
```

**Status:** ❌ BLOCKS MERGE

---

### 🔴 CRITICAL-2: crawl-gasoline-vn Lines 15-18 — Symbol Mismatch

**File:** `supabase/functions/crawl-gasoline-vn/index.ts`
**Location:** Lines 15-18
**Severity:** CRITICAL

```typescript
15:  { pattern: /RON\s*95.*III/i, symbol: "RON95" },
16:  { pattern: /E5\s*RON\s*92/i, symbol: "RON98" },
17:  { pattern: /DO\s*0[,.]001/i, symbol: "DIESEL" },
```

**Problem:** Symbol names DON'T match CHECK constraint in migration.
- Code uses: `"RON95"`, `"RON98"`, `"DIESEL"`
- Migration allows: `'RON95'`, `'RON98'`, `'DIESEL'` (string case sensitive in SQL)

Actually checked — these ARE correct. However:

**Real Issue:** The semantics are confusing:
- Pattern `E5\s*RON\s*92` matches E5 RON 92, but symbol is `"RON98"`
- E5 RON 92 ≠ RON 98 (RON 92 is lower octane)
- Should symbol be `"RON92"` instead? Or pattern should match E5 RON 95?

**Impact:**
- Wrong fuel type will be recorded in database (RON 92 premium tracked as RON 98)
- Price comparisons and reporting will be incorrect
- Misleading commodity price tracking

**Fix:**
Clarify correct fuel mappings:
```typescript
{ pattern: /E5\s*RON\s*92/i, symbol: "RON92" },  // IF E5 RON 92 is tracked
// OR
{ pattern: /E5\s*RON\s*95/i, symbol: "RON98" },  // IF mapping should be RON95→RON98
```

**Status:** ❌ BLOCKS MERGE — Requires business logic clarification

---

### 🔴 CRITICAL-3: All Crawlers — Missing Error Handling for Empty Results

**Files:** All 3 crawlers
**Severity:** CRITICAL (potential data integrity)

**Problem:** Edge case not properly handled:

**crawl-gold-vn** (line 188-189):
```typescript
if (allRecords.length === 0) {
  return errorResponse("All crawlers failed: " + errors.join("; "), 502);
}
```
Good error handling, but:
- If SJC succeeds with deduplicated records, but PNJ/DOJI fail: returns 200 OK with partial data
- Caller cannot distinguish: "all scraped" vs "partial success with errors"

**crawl-silver-vn** (lines 52-54):
```typescript
if (!bid || !ask) {
  throw new Error("Silver price not found in HTML table");
}
```
Caught at line 72-73:
```typescript
} catch (err) {
  return errorResponse(`${err}`, 502);
}
```
**Problem:** If no silver price found, returns 502 but falls through catch block without proper status handling.

**crawl-gasoline-vn** (lines 76-77):
```typescript
if (records.length === 0) {
  throw new Error("No fuel prices found in HTML table");
}
```
Same issue — caught and returns 502, but error response on line 90 includes raw error object.

**Impact:**
- Partial data insertion without clear caller notification
- HTTP status codes don't reliably indicate success vs. partial failure
- Potential for inconsistent state in time-series data

**Fix:**
1. Return structured response indicating success/partial/failure:
```typescript
return jsonResponse({
  inserted: allRecords.length,
  symbols: allRecords.map(r => r.symbol),
  status: errors.length > 0 ? "partial" : "success",
  errors: errors.length ? errors : undefined,
}, errors.length && allRecords.length === 0 ? 502 : 200);
```

2. Only insert if all required sources succeeded (strict mode).

**Status:** ❌ BLOCKS MERGE

---

## Medium Issues (7)

### ⚠️ MEDIUM-1: crawl-gold-vn Line 41 — Loose Truthiness Check

**File:** `supabase/functions/crawl-gold-vn/index.ts`
**Location:** Line 41

```typescript
if (!buy || !sell) continue;
```

**Problem:**
- `!0` is truthy (will skip), but price of 0 is technically valid (shouldn't occur in practice)
- Should explicitly check for valid numbers: `if (buy <= 0 || sell <= 0)`

**Impact:** Low — XML parser should never return 0 from attribute parsing
**Fix:**
```typescript
if (buy <= 0 || sell <= 0) continue;  // explicit boundary check
```
**Severity:** MEDIUM | **Recommended:** Fix

---

### ⚠️ MEDIUM-2: crawl-silver-vn Line 27-28 — Uninitialized Variables in Loop

**File:** `supabase/functions/crawl-silver-vn/index.ts`
**Location:** Lines 27-28

```typescript
let bid = 0;
let ask = 0;
// ... loop processes and modifies bid, ask
// Lines 44-50: fallback to first row if no match
```

**Problem:**
- Variables initialized to 0, then checked `if (!bid || !ask)` on line 52
- If fallback loop (44-50) also fails to find prices, bid/ask remain 0
- Throws error with `!bid || !ask` correctly, but initialization to 0 is confusing
- Should initialize to `null` to distinguish "not set" from "found zero"

**Impact:** MEDIUM — Code works but is semantically unclear
**Fix:**
```typescript
let bid: number | null = null;
let ask: number | null = null;
// ... at line 52
if (bid === null || ask === null) {
  throw new Error("Silver price not found");
}
```
**Severity:** MEDIUM | **Recommended:** Fix for clarity

---

### ⚠️ MEDIUM-3: crawl-gasoline-vn Line 56 — Unused Fallback Logic

**File:** `supabase/functions/crawl-gasoline-vn/index.ts`
**Location:** Lines 55-56

```typescript
const priceVung1 = parseVNPrice(extractText(cells[1]));
if (!priceVung1) continue;
```

**Problem:**
- If price is missing (empty cell), skips row
- Later (line 76) checks if `records.length === 0`
- But no fallback to use Vùng 2 (region 2) price from cells[2]
- Comments say "We use Vùng 1 price" but no logic to handle Vùng 1 missing

**Impact:** MEDIUM — Missing fuel price if Vùng 1 unavailable
**Fix:**
```typescript
let price = parseVNPrice(extractText(cells[1]));  // Vùng 1
if (!price && cells.length > 2) {
  price = parseVNPrice(extractText(cells[2]));  // Vùng 2 fallback
}
if (!price) continue;
```
**Severity:** MEDIUM | **Recommended:** Add fallback

---

### ⚠️ MEDIUM-4: html-parser.ts Line 52 — Unreachable Code

**File:** `supabase/functions/_shared/html-parser.ts`
**Location:** Line 52

```typescript
for (let attempt = 0; attempt < 2; attempt++) {
  try { ... }
  catch (err) {
    if (attempt === 0) {
      // retry
    } else {
      throw err;  // line 48
    }
  }
}
throw new Error("Unreachable");  // line 52
```

**Problem:**
- Loop always throws on attempt 1 (second attempt)
- Line 52 is unreachable (after throw, loop exits)
- TypeScript/Deno compiler might flag this

**Impact:** LOW — Code works, but unreachable code warns about logic clarity
**Fix:**
```typescript
for (let attempt = 0; attempt < 2; attempt++) {
  try { ... return ... }
  catch (err) {
    if (attempt === 0) {
      console.warn(...);
      await new Promise(r => setTimeout(r, 2000));
    } else {
      throw err;  // 2nd attempt fails, throws
    }
  }
}
// Remove unreachable line 52
```
**Severity:** MEDIUM | **Recommended:** Remove unreachable code or restructure

---

### ⚠️ MEDIUM-5: crawl-silver-vn Line 73 — Error Response Includes Raw Error Object

**File:** `supabase/functions/crawl-silver-vn/index.ts`
**Location:** Line 73

```typescript
return errorResponse(`${err}`, 502);
```

**Problem:**
- `err` is an Error object, will be stringified as `[object Object]` if not `.toString()`
- Should call `.message` property explicitly
- Other crawlers handle this better (crawl-gold-vn line 182: `result.reason`)

**Impact:** MEDIUM — Error message becomes unintelligible to caller
**Fix:**
```typescript
const msg = err instanceof Error ? err.message : String(err);
return errorResponse(msg, 502);
```
**Severity:** MEDIUM | **Recommended:** Fix for better debugging

---

### ⚠️ MEDIUM-6: crawl-gasoline-vn Line 89 — Inconsistent Error Handling

**File:** `supabase/functions/crawl-gasoline-vn/index.ts`
**Location:** Line 89

```typescript
} catch (err) {
  console.error(`crawl-gasoline-vn failed: ${err}`);
  return errorResponse(`${err}`, 502);
}
```

**Problem:**
- Same as MEDIUM-5: `${err}` will stringify Error object
- Also: `console.error` logs raw error, which might expose stack traces to logs
- crawl-gold-vn handles this better with structured error array

**Impact:** MEDIUM — Logs become hard to parse, error response unclear
**Fix:**
```typescript
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`crawl-gasoline-vn failed: ${msg}`);
  return errorResponse(msg, 502);
}
```
**Severity:** MEDIUM | **Recommended:** Fix

---

### ⚠️ MEDIUM-7: CORS Headers — Missing X-Crawl-Secret Requirement

**File:** `supabase/functions/_shared/response-helpers.ts`
**Location:** Lines 3-6

```typescript
const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};
```

**Problem:**
- CORS header allows `authorization` and `content-type` but doesn't include `x-crawl-secret`
- crawl-gold-vn and others check `x-crawl-secret` header (html-parser.ts line 59)
- Browser preflight OPTIONS won't allow the header without explicit CORS declaration

**Impact:** MEDIUM — Client-side JavaScript calls will fail due to CORS restrictions
**Fix:**
```typescript
const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-crawl-secret",
};
```
**Severity:** MEDIUM | **Recommended:** Fix if browser access needed

---

## Edge Case Analysis

### Empty HTML Scenarios

**parseHTML()** (html-parser.ts line 5):
- Returns valid but empty Document if HTML is empty or malformed ✅
- `.querySelectorAll()` returns empty NodeList (not null) ✅
- All crawlers check `rows.length > 0` or handle empty iteration ✅

### Missing Elements

**extractText()** (html-parser.ts line 10):
```typescript
return el?.textContent?.trim() ?? "";
```
- Returns empty string if element null or textContent empty ✅
- All callers check result before parsing ✅

### Zero/Invalid Prices

**parseVNPrice()** (html-parser.ts line 19-22):
```typescript
export function parseVNPrice(text: string): number {
  const cleaned = text.replace(/\./g, "").replace(/,/g, "").trim();
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : 0;  // Returns 0 on fail
}
```
- Returns 0 if parsing fails ✅
- Crawlers check `if (!bid || !ask)` to reject 0 prices ⚠️ (loose truthiness, see MEDIUM-1)
- gasoline crawler also checks `if (!priceVung1)` ✅

### Network Failures

**fetchWithRetry()** (html-parser.ts line 26-53):
- 2 attempts with 2s delay between attempts ✅
- 30s timeout per attempt ✅
- Throws after 2 failures (handled by callers) ✅
- crawl-gold-vn: uses Promise.allSettled to gracefully handle partial failures ✅
- crawl-silver-vn: throws error, caught in main try/catch ✅
- crawl-gasoline-vn: throws error, caught in main try/catch ✅

**Verdict:** Edge case handling is reasonable but could be more explicit.

---

## Security Analysis

### ✅ PASS: Authentication
- All crawlers verify `CRAWL_SECRET` header (html-parser.ts line 56-68) ✅
- Uses `Deno.env.get()` correctly ✅
- Returns 401 Unauthorized if missing/invalid ✅

### ✅ PASS: Environment Variables
- SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY properly validated ✅
- CRAWL_SECRET checked ✅

### ✅ PASS: SQL Injection Prevention
- All crawls insert records with parsed numeric/string values, no SQL concatenation ✅
- Supabase JS client handles parameterized queries ✅

### ⚠️ CAUTION: CORS Policy
- All responses include `"Access-Control-Allow-Origin": "*"` (allow all origins) ⚠️
- If crawlers are called from browser, this is necessary but adds risk
- Consider restricting to specific origins in production

### ✅ PASS: User-Agent Header
- fetchWithRetry sets realistic User-Agent (html-parser.ts line 28-29) ✅
- Mimics browser to avoid blocks from scraped sites ✅

---

## Import Validation Checklist

| Import | File | Status | Notes |
|--------|------|--------|-------|
| `createServiceClient` | supabase-client.ts | ✅ | ESM @supabase/supabase-js@2 |
| `jsonResponse, errorResponse, corsResponse` | response-helpers.ts | ✅ | Local relative imports |
| `parseHTML, extractText, parseVNPrice, fetchWithRetry, verifyCrawlSecret` | html-parser.ts | ✅ | Local + deno.land deno_dom |
| `DOMParser` | deno.land/x/deno_dom | ✅ | WASM-based, Deno-compatible |
| `fetch` | Deno native | ✅ | Built-in to Deno runtime |
| `Deno.env.get()` | Deno native | ✅ | Built-in to Deno runtime |
| `Deno.serve()` | Deno native | ✅ | Built-in, stable for Edge Functions |

**Verdict:** All imports valid for Supabase Edge Functions.

---

## Type Safety Analysis

### ✅ PASS: Interface Definitions
```typescript
interface PriceRecord {
  symbol: string;
  price: number;
  bid: number | null;
  ask: number | null;
  unit: string;
  source: string;
  fetched_at: string;
}
```
- Matches database schema exactly ✅
- Optional fields (bid, ask) correctly typed as nullable ✅

### ✅ PASS: Type Annotations
- Function parameters typed (crawlSJC, crawlPNJ, crawlDOJI) ✅
- Return types inferred or explicit ✅

### ⚠️ CAUTION: Any Types
- `doc: Document | null` from parseHTML not fully type-checked (can be null) ✅ Handled
- No explicit `any` types found ✅

---

## Test Compilation (Static)

**Simulated Type Checking:**
- No obvious TypeScript errors detected in source
- All function signatures consistent with callsites
- All imports resolve to valid modules

**Verdict:** Code should compile successfully in Deno v2 (per config.toml line 362).

---

## Recommendations (Priority Order)

### P0 — MUST FIX (Blocks Merge)

1. **Fix crawl-silver-vn line 36 logic error:**
   - Change `&&` to `||` in condition
   - Test against webgia.com HTML structure to ensure correct row matching

2. **Clarify crawl-gasoline-vn fuel mappings:**
   - Confirm E5 RON 92 should map to "RON92" or pattern should match E5 RON 95
   - Verify with business/product requirements
   - Add comment explaining mapping rationale

3. **Improve error handling across all crawlers:**
   - Return structured response with `status: "success" | "partial" | "error"`
   - Only insert if all required sources succeed (or clearly mark as partial)
   - Fix Error object stringification in crawl-silver-vn and crawl-gasoline-vn

### P1 — SHOULD FIX (Recommended Before Prod)

4. Add fallback to Vùng 2 fuel price if Vùng 1 unavailable (crawl-gasoline-vn)
5. Use explicit numeric boundary checks (`<= 0`) instead of loose truthiness (`!bid`)
6. Fix CORS header to include `x-crawl-secret` if browser access needed
7. Remove unreachable code in html-parser.ts line 52

### P2 — NICE TO HAVE (Quality Improvements)

8. Initialize silver crawler variables as `null` instead of `0` for semantic clarity
9. Add JSDoc comments explaining HTML structure expectations for each crawler
10. Consider rate limiting on CRAWL_SECRET verification to prevent brute force
11. Add structured logging with timestamps and request IDs for debugging

---

## Deployment Checklist

- [ ] Fix CRITICAL-1: crawl-silver-vn logic error
- [ ] Fix CRITICAL-2: crawl-gasoline-vn fuel mapping ambiguity
- [ ] Fix CRITICAL-3: Error handling and response consistency
- [ ] Fix MEDIUM-1 through MEDIUM-7
- [ ] Set CRAWL_SECRET environment variable in Supabase project
- [ ] Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
- [ ] Test each crawler with real webgia.com/SJC endpoints
- [ ] Verify database UNIQUE(symbol, fetched_at) constraint doesn't cause duplicate key errors
- [ ] Test OPTIONS preflight requests for CORS compliance
- [ ] Monitor first 24 hours of production for HTML structure changes

---

## Summary Table

| Category | Status | Details |
|----------|--------|---------|
| **Syntax** | ✅ PASS | No compilation errors detected |
| **Imports** | ✅ PASS | All paths valid for Deno Edge Functions |
| **Database Schema** | ✅ PASS | Columns and symbols match migration |
| **Type Safety** | ✅ PASS | Interface and annotations consistent |
| **Logic Errors** | ❌ FAIL | 3 critical + 7 medium issues found |
| **Error Handling** | ⚠️ PARTIAL | Inconsistent error responses |
| **Edge Cases** | ✅ GOOD | Empty HTML, missing elements handled |
| **Security** | ✅ PASS | Auth, injection protection verified |
| **Overall** | ❌ NOT READY | Critical issues block merge |

---

## Unresolved Questions

1. **Fuel Mapping Ambiguity:** Does E5 RON 92 actually map to RON98 symbol? Should clarify with product team.
2. **Partial Success Handling:** Should partial data (2/3 sources succeed) return 200 or 206 (Partial Content)? Current behavior returns 200 but logs errors.
3. **CORS Security:** Is allowing `"*"` origin acceptable? Should restrict to specific domains in production.
4. **Deduplication Strategy:** crawl-gold-vn deduplicates by symbol, but webgia.com might have multiple rows per symbol. Is keeping first match correct?
5. **Empty Cell Handling:** What should happen if a price cell is empty string? Current behavior: skip row (gasoline), use fallback (silver). Consistent strategy needed.

---

## Next Steps

1. Create PR to fix issues (separate P0, P1, P2 commits)
2. Run `supabase functions serve` locally to validate compilation
3. Test each crawler with real endpoints (webgia.com, sjc.com.vn)
4. Verify UNIQUE constraint behavior with duplicate timestamps
5. Set up integration tests using supabase local dev environment
6. Conduct code review with team before merge
7. Plan monitoring/alerting for crawler failures in production

---

**Report Generated:** 2026-03-10 13:17 UTC
**Validator:** QA Tester | **Subagent ID:** aa63723d08eb78755
