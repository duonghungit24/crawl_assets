# Code Review: Phase 01 - Setup & DB Schema

## Scope
- **Files**: 5 (1 SQL migration, 2 TS shared modules, 1 env template, 1 gitignore)
- **LOC**: ~55 (excluding config)
- **Focus**: Phase 01 implementation vs plan spec

## Overall Assessment

Solid foundation. Schema is clean, shared modules are minimal and correct. A few gaps between plan requirements and implementation need attention before moving to Phase 02.

---

## Critical Issues

### 1. Missing CHECK constraint for valid symbols (Plan Requirement Gap)

**File**: `supabase/migrations/20260310000001_create_prices_table.sql`

Plan states: _"Enum or check constraint for valid symbols"_ under Functional Requirements. The migration has no constraint on `symbol` or `source`.

**Impact**: Any arbitrary string can be inserted, making typos (`sjc_999` vs `SJC_9999`) silent data corruption.

**Fix** (preferred - CHECK constraint, easier to extend than ENUM):
```sql
ALTER TABLE prices ADD CONSTRAINT chk_symbol CHECK (
  symbol IN (
    'SJC_9999', 'SJC_RING', 'PNJ_GOLD', 'DOJI_GOLD',
    'PNJ_SILVER',
    'RON95', 'RON98', 'DIESEL',
    'XAU_USD', 'XAG_USD',
    'WTI_USD', 'BRENT_USD', 'RBOB_USD'
  )
);
```

**Alternative**: If symbols will grow frequently, skip the constraint and validate in Edge Function code instead. But document this decision.

### 2. RLS policy missing UPDATE/DELETE for service_role

**File**: `supabase/migrations/20260310000001_create_prices_table.sql`

Only `INSERT` policy exists for `service_role`. If a crawl inserts bad data, there is no way to UPDATE or DELETE via the API without disabling RLS or using raw SQL.

**Impact**: Operational risk -- cannot correct data via API.

**Fix**:
```sql
CREATE POLICY "service_update" ON prices FOR UPDATE TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_delete" ON prices FOR DELETE TO service_role USING (true);
```

---

## High Priority

### 3. UNIQUE constraint creates a redundant index

**File**: `supabase/migrations/20260310000001_create_prices_table.sql`

`UNIQUE(symbol, fetched_at)` auto-creates an index `prices_symbol_fetched_at_key` on `(symbol, fetched_at)` in ASC order. Then `idx_prices_symbol_fetched` is created on `(symbol, fetched_at DESC)`.

These are almost identical. The DESC index is useful for `ORDER BY ... DESC` queries but the UNIQUE index is redundant for lookups.

**Impact**: Extra write overhead on every INSERT (maintaining two near-identical B-trees). Minimal for this data volume but worth noting.

**Recommendation**: Acceptable at current scale. No action needed unless write throughput becomes a concern.

### 4. CORS wildcard origin

**File**: `supabase/functions/_shared/response-helpers.ts`

`Access-Control-Allow-Origin: *` allows any origin. Plan mentions this is a read-only public API, so this is likely intentional.

**Impact**: Low risk since data is public commodity prices. But if `x-crawl-secret` header is used for write endpoints, CORS preflight will expose that this header is accepted.

**Recommendation**: Acceptable for public read API. When adding write endpoints, consider restricting `Access-Control-Allow-Headers` to not advertise `x-crawl-secret` in the shared CORS headers. Write functions should define their own headers.

### 5. No OPTIONS handler for CORS preflight

**File**: `supabase/functions/_shared/response-helpers.ts`

No helper for handling `OPTIONS` preflight requests. Every Edge Function that uses CORS will need to handle this.

**Fix** - add to response-helpers.ts:
```typescript
/** Handle CORS preflight */
export function corsResponse(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
```

---

## Medium Priority

### 6. `createServiceClient` creates a new client on every call

**File**: `supabase/functions/_shared/supabase-client.ts`

Each call to `createServiceClient()` instantiates a new `SupabaseClient`. In Deno Deploy (Edge Functions runtime), functions are short-lived, so this is fine per invocation. But if a single function calls it multiple times, it wastes resources.

**Recommendation**: Acceptable pattern for Edge Functions. If needed later, memoize with module-level caching:
```typescript
let _client: SupabaseClient | null = null;
export function createServiceClient(): SupabaseClient {
  if (_client) return _client;
  // ... same logic
  _client = createClient(url, key);
  return _client;
}
```

### 7. `source` column has no validation

**File**: `supabase/migrations/20260310000001_create_prices_table.sql`

Plan lists specific sources: `sjc, pnj, doji, petrolimex, eia, yahoo`. No constraint enforces this.

**Recommendation**: Add CHECK constraint or document as intentionally unconstrained.

### 8. No `SECURITY DEFINER` or `SECURITY INVOKER` on RPC function

**File**: `supabase/migrations/20260310000001_create_prices_table.sql`

`get_latest_prices()` defaults to `SECURITY INVOKER` (PostgreSQL 16+). This means RLS applies -- anon can call it and get results (SELECT policy allows). This is correct behavior for a public read API.

**Note**: Explicitly adding `SECURITY INVOKER` would make intent clearer for future maintainers.

### 9. `unit` column defaults to 'VND' but world prices use USD

**File**: `supabase/migrations/20260310000001_create_prices_table.sql`

Default is `VND` but symbols like `XAU_USD`, `WTI_USD` use USD. Crawlers must remember to set `unit = 'USD'` explicitly.

**Recommendation**: Either remove the default (force explicit unit on every insert) or add a CHECK constraint: `CHECK (unit IN ('VND', 'USD'))`. Removing the default is safer -- it forces crawlers to be explicit.

---

## Low Priority

### 10. `esm.sh` CDN dependency

**File**: `supabase/functions/_shared/supabase-client.ts`

Using `https://esm.sh/@supabase/supabase-js@2` pins to major version only. A breaking minor/patch release could theoretically break builds.

**Recommendation**: Pin to exact version: `@supabase/supabase-js@2.49.1` (or current latest).

### 11. `.env.example` could include inline comments

**File**: `.env.example`

No descriptions for what each variable is or where to get it.

**Recommendation**:
```
# Supabase project URL (Settings > API > Project URL)
SUPABASE_URL=
# Supabase anonymous key (Settings > API > anon/public)
SUPABASE_ANON_KEY=
# Supabase service role key (Settings > API > service_role)
SUPABASE_SERVICE_ROLE_KEY=
# EIA API key (https://www.eia.gov/opendata/register.php)
EIA_API_KEY=
# Secret for authenticating crawl triggers
CRAWL_SECRET=
```

---

## Edge Cases Found

1. **UNIQUE constraint + `DEFAULT now()`**: If two crawlers insert the same symbol within the same microsecond (e.g., concurrent GitHub Actions), the UNIQUE constraint will cause one to fail. Unlikely but possible with parallel workflows. Mitigation: use `ON CONFLICT (symbol, fetched_at) DO UPDATE` in crawlers.

2. **`DISTINCT ON` ordering**: The RPC function uses `DISTINCT ON (symbol)` which is PostgreSQL-specific (not standard SQL). Fine for Supabase/PostgreSQL but worth noting for portability.

3. **`fetched_at` vs `created_at` semantics**: Both default to `now()`. If a crawl fetches data and then inserts 30 seconds later, `fetched_at` would be wrong. Crawlers should explicitly set `fetched_at` to the time the source was scraped, not insertion time.

4. **No data retention policy**: Time-series data grows unbounded. Consider a scheduled cleanup or partitioning strategy for Phase 06.

5. **RPC function returns `*`**: `get_latest_prices()` returns all columns via `SETOF prices`. If columns are added later, the function signature changes automatically. This is fine but could break client expectations.

---

## Positive Observations

- Clean, minimal schema -- single table design is appropriate for the data volume
- `GENERATED ALWAYS AS IDENTITY` is modern best practice (vs `SERIAL`)
- `NUMERIC(18,4)` provides sufficient precision for financial data
- `TIMESTAMPTZ` correctly used (timezone-aware)
- Shared modules are well-structured and concise
- Error handling in `createServiceClient()` with clear error message
- `.gitignore` correctly excludes env files while preserving `.env.example`
- `bid`/`ask` nullable columns handle cases where only a single price exists

---

## Plan Todo Checklist Status

| Task | Status | Notes |
|------|--------|-------|
| Install Supabase CLI | Unknown | Cannot verify CLI installation |
| Run `supabase init` | Done | `supabase/config.toml` exists |
| Create prices table migration | Done | Schema matches plan |
| Add RLS policies | Partial | SELECT + INSERT only, missing UPDATE/DELETE |
| Create shared supabase client | Done | Clean implementation |
| Create shared response helpers | Done | Missing OPTIONS handler |
| Create `.env.example` | Done | Missing inline comments |
| Update `.gitignore` | Done | `supabase/.temp/` added |
| Link remote project and push migration | Unknown | Cannot verify remote state |

---

## Recommended Actions (Priority Order)

1. **Add symbol CHECK constraint** or document decision to skip it (Critical)
2. **Add UPDATE/DELETE RLS policies** for service_role (Critical)
3. **Add `corsResponse()` helper** for OPTIONS preflight (High)
4. **Remove `DEFAULT 'VND'`** from unit column or add CHECK constraint (Medium)
5. **Add source CHECK constraint** or validate in application code (Medium)
6. **Pin `esm.sh` import** to exact version (Low)
7. **Add comments to `.env.example`** (Low)

---

## Unresolved Questions

1. Should `symbol` validation live in the DB (CHECK constraint) or application layer (Edge Functions)? DB is safer but harder to update; app layer is flexible but risks inconsistency.
2. Is `CRAWL_SECRET` a shared secret across all crawl functions, or per-function? Current `.env.example` suggests shared.
3. What is the data retention strategy? Unbounded time-series will eventually hit the 500MB free tier limit.
4. Should `fetched_at` default be removed to force crawlers to set it explicitly? This prevents silent bugs where insertion time != fetch time.
