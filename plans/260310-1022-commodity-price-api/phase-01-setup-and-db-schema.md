# Phase 01: Setup & DB Schema

## Context Links
- [Plan Overview](plan.md)
- [Supabase Edge Functions docs](https://supabase.com/docs/guides/functions)
- [Supabase CLI](https://supabase.com/docs/guides/cli)

## Overview
- **Priority**: P1 (blocking all other phases)
- **Status**: done
- **Effort**: 2h
- Initialize Supabase project, define DB schema, configure env, set up project structure.

## Key Insights
- Supabase CLI (`supabase init`) scaffolds `supabase/` dir with `functions/` and `migrations/`
- PostgREST auto-exposes tables — schema design = API design
- Single `prices` table with composite index on `(symbol, fetched_at)` covers all query patterns
- RLS policies: anon = read-only, service_role = full write

## Requirements

### Functional
- PostgreSQL schema for commodity prices (time-series)
- Enum or check constraint for valid symbols
- Dedup constraint (no duplicate symbol+timestamp rows)
- RPC function `get_latest_prices()` returning latest price per symbol

### Non-Functional
- Indexes for fast queries by symbol + date range
- RLS enabled for security

## Architecture

### Database Schema

```sql
-- prices table
CREATE TABLE prices (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  symbol TEXT NOT NULL,
  price NUMERIC(18,4) NOT NULL,
  bid NUMERIC(18,4),          -- buy price (VN gold)
  ask NUMERIC(18,4),          -- sell price (VN gold)
  unit TEXT NOT NULL DEFAULT 'VND',  -- VND or USD
  source TEXT NOT NULL,        -- sjc, pnj, doji, petrolimex, eia, yahoo
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(symbol, fetched_at)
);

-- Indexes
CREATE INDEX idx_prices_symbol_fetched ON prices(symbol, fetched_at DESC);
CREATE INDEX idx_prices_fetched ON prices(fetched_at DESC);

-- RPC: latest price per symbol
CREATE OR REPLACE FUNCTION get_latest_prices()
RETURNS SETOF prices AS $$
  SELECT DISTINCT ON (symbol) *
  FROM prices
  ORDER BY symbol, fetched_at DESC;
$$ LANGUAGE sql STABLE;
```

### Project Structure

```
assets_api/
├── supabase/
│   ├── config.toml
│   ├── migrations/
│   │   └── 20260310000001_create_prices_table.sql
│   └── functions/
│       ├── _shared/
│       │   ├── supabase-client.ts    -- shared Supabase client init
│       │   ├── html-parser.ts        -- shared HTML parsing utils
│       │   └── response-helpers.ts   -- shared HTTP response helpers
│       ├── crawl-gold-vn/
│       │   └── index.ts
│       ├── crawl-silver-vn/
│       │   └── index.ts
│       ├── crawl-gasoline-vn/
│       │   └── index.ts
│       ├── crawl-oil-world/
│       │   └── index.ts
│       ├── crawl-metals-world/
│       │   └── index.ts
│       └── crawl-gasoline-world/
│           └── index.ts
├── .github/
│   └── workflows/
│       └── crawl-prices.yml
├── .env.example
├── .gitignore
└── README.md
```

## Related Code Files
- **Create**: `supabase/config.toml`, `supabase/migrations/20260310000001_create_prices_table.sql`
- **Create**: `supabase/functions/_shared/supabase-client.ts`
- **Create**: `supabase/functions/_shared/response-helpers.ts`
- **Create**: `.env.example`
- **Modify**: `.gitignore` (add supabase-specific ignores)

## Implementation Steps

1. Install Supabase CLI if not present: `brew install supabase/tap/supabase`
2. Run `supabase init` in project root — generates `supabase/` directory
3. Create migration file `supabase/migrations/20260310000001_create_prices_table.sql` with schema above
4. Add RLS policies in same migration:
   ```sql
   ALTER TABLE prices ENABLE ROW LEVEL SECURITY;
   CREATE POLICY "anon_read" ON prices FOR SELECT TO anon USING (true);
   CREATE POLICY "service_write" ON prices FOR INSERT TO service_role WITH CHECK (true);
   ```
5. Create `supabase/functions/_shared/supabase-client.ts`:
   - Import `createClient` from supabase-js (via esm.sh CDN for Deno)
   - Export factory function using `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` env vars
6. Create `supabase/functions/_shared/response-helpers.ts`:
   - `jsonResponse(data, status)` helper
   - `errorResponse(message, status)` helper
7. Create `.env.example` with required env vars:
   ```
   SUPABASE_URL=
   SUPABASE_ANON_KEY=
   SUPABASE_SERVICE_ROLE_KEY=
   EIA_API_KEY=
   CRAWL_SECRET=
   ```
8. Update `.gitignore` — add `supabase/.temp/`
9. Link to remote Supabase project: `supabase link --project-ref <ref>`
10. Push migration: `supabase db push`

## Todo List
- [x] Install Supabase CLI (v2.75.0)
- [x] Run `supabase init`
- [x] Create prices table migration (with CHECK constraints on symbol + unit)
- [x] Add RLS policies (anon SELECT, service_role ALL)
- [x] Create shared supabase client module
- [x] Create shared response helpers (with CORS + OPTIONS handler)
- [x] Create `.env.example`
- [x] Update `.gitignore`
- [x] Link remote project and push migration

## Success Criteria
- `supabase db push` succeeds, table exists in remote DB
- PostgREST endpoint `/rest/v1/prices` returns empty array (200 OK)
- RLS blocks anon INSERT attempts (403)
- `get_latest_prices()` callable via `/rest/v1/rpc/get_latest_prices`

## Risk Assessment
| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Supabase free tier limits (500MB DB, 2 Edge Function invocations/sec) | Low | Price data is tiny; crawl hourly = ~24 invocations/day |
| Schema changes after data exists | Medium | Use incremental migrations, never edit existing migration files |

## Security Considerations
- Service role key stored as GitHub Actions secret, never in code
- `CRAWL_SECRET` header checked by Edge Functions to prevent unauthorized triggers
- RLS enforced: anon can only SELECT, service_role can INSERT
