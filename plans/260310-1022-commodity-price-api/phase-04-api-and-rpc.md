# Phase 04: API & RPC

## Context Links
- [Plan Overview](plan.md)
- [Phase 01: Setup](phase-01-setup-and-db-schema.md)
- [PostgREST docs](https://postgrest.org/en/stable/)

## Overview
- **Priority**: P2
- **Status**: done
- **Effort**: 1.5h
- **Depends on**: Phase 01
- Configure PostgREST auto API, create RPC functions, set up RLS policies for client access.

## Key Insights
- PostgREST auto-generates REST endpoints for all tables in `public` schema — zero code needed
- RPC functions exposed at `/rest/v1/rpc/{function_name}`
- Supabase client libraries handle auth headers automatically
- Filtering built-in: `?symbol=eq.XAU_USD&fetched_at=gte.2026-03-01`

## Requirements

### Functional
- **GET /rest/v1/prices** — list prices with filtering, pagination, ordering
- **GET /rest/v1/rpc/get_latest_prices** — latest price per symbol
- **GET /rest/v1/rpc/get_price_history** — prices for a symbol within date range
- All endpoints require anon key in `apikey` header (Supabase default)

### Non-Functional
- Response time < 200ms for latest prices query
- Pagination via `Range` header (PostgREST default)

## Architecture

### Auto-generated Endpoints (from PostgREST)
No code needed. These work automatically once table exists:
```
GET /rest/v1/prices?symbol=eq.XAU_USD&order=fetched_at.desc&limit=10
GET /rest/v1/prices?symbol=in.(XAU_USD,XAG_USD)&fetched_at=gte.2026-03-01
GET /rest/v1/prices?select=symbol,price,fetched_at&order=fetched_at.desc
```

### RPC Functions

```sql
-- Already created in Phase 01: get_latest_prices()

-- New: get_price_history(symbol, from_date, to_date)
CREATE OR REPLACE FUNCTION get_price_history(
  p_symbol TEXT,
  p_from TIMESTAMPTZ DEFAULT now() - INTERVAL '7 days',
  p_to TIMESTAMPTZ DEFAULT now()
)
RETURNS SETOF prices AS $$
  SELECT * FROM prices
  WHERE symbol = p_symbol
    AND fetched_at BETWEEN p_from AND p_to
  ORDER BY fetched_at DESC;
$$ LANGUAGE sql STABLE;
```

## Related Code Files
- **Create**: `supabase/migrations/20260310000002_create_rpc_functions.sql`

## Implementation Steps

1. Create migration `20260310000002_create_rpc_functions.sql`:
   - `get_price_history(p_symbol, p_from, p_to)` function
   - Grant EXECUTE to anon role on both RPC functions
2. Push migration: `supabase db push`
3. Test auto-generated endpoints:
   ```bash
   # List all prices
   curl "$SUPABASE_URL/rest/v1/prices" -H "apikey: $ANON_KEY"

   # Filter by symbol
   curl "$SUPABASE_URL/rest/v1/prices?symbol=eq.XAU_USD&order=fetched_at.desc&limit=5" \
     -H "apikey: $ANON_KEY"

   # Latest prices
   curl "$SUPABASE_URL/rest/v1/rpc/get_latest_prices" -H "apikey: $ANON_KEY"

   # Price history
   curl "$SUPABASE_URL/rest/v1/rpc/get_price_history" \
     -H "apikey: $ANON_KEY" \
     -H "Content-Type: application/json" \
     -d '{"p_symbol":"XAU_USD","p_from":"2026-03-01","p_to":"2026-03-10"}'
   ```
4. Verify RLS: confirm anon can SELECT but not INSERT/UPDATE/DELETE

## Todo List
- [x] Create RPC migration (get_price_history)
- [x] Push migration
- [x] Test PostgREST auto endpoints
- [x] Test RPC functions
- [x] Verify RLS blocks writes from anon

## Success Criteria
- All endpoints return correct data with proper filtering
- `get_latest_prices` returns exactly one row per symbol
- `get_price_history` returns time-series data within requested range
- Anon INSERT/UPDATE/DELETE return 403

## Risk Assessment
| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| PostgREST query performance on large dataset | Low | Indexes on (symbol, fetched_at) cover all patterns |
| API abuse (excessive queries) | Low | Supabase rate limiting on free tier; add API key rotation if needed |
