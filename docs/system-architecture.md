# System Architecture

## High-Level Overview

```
┌──────────────────┐
│ GitHub Actions   │
│   (6 cron jobs)  │
└────────┬─────────┘
         │ HTTP POST
         ├─► edge-function-{crawler-name}
         │   ├─ Auth check (CRAWL_SECRET)
         │   ├─ Fetch data (HTML/API)
         │   ├─ Parse data
         │   └─ UPSERT to DB
         │
    ┌────▼─────────────────────────┐
    │ Supabase Edge Functions       │
    │ (6 crawlers in Deno/TS)       │
    │ - crawl-gold-vn              │
    │ - crawl-silver-vn            │
    │ - crawl-gasoline-vn          │
    │ - crawl-oil-world            │
    │ - crawl-metals-world         │
    │ - crawl-gasoline-world       │
    └────┬──────────────────────────┘
         │ SQL INSERT/UPDATE
         │
    ┌────▼─────────────────┐
    │ PostgreSQL `prices`  │
    │   table (Supabase)   │
    │                      │
    │ - id                 │
    │ - symbol             │
    │ - price, bid, ask    │
    │ - unit, source       │
    │ - fetched_at         │
    │ - created_at         │
    └────┬─────────────────┘
         │ RLS + indexes
         │
    ┌────▼────────────────────┐
    │ Supabase PostgREST API   │
    │ (auto-generated from DB) │
    │                          │
    │ GET /rest/v1/prices      │
    │ GET /rest/v1/rpc/*       │
    └────┬─────────────────────┘
         │ JSON + anon_key
         │
    ┌────▼─────────────┐
    │ Client Apps       │
    │ (REST requests)   │
    └───────────────────┘
```

---

## Core Components

### 1. Data Ingestion Layer (Edge Functions)

**Purpose:** Crawl commodity prices from external sources, transform, store.

**Components:**

#### A. HTML Scrapers (VN Commodities)

**crawl-gold-vn**
- **Source:** webgia.com (table HTML)
- **Symbols:** SJC_9999, SJC_RING, PNJ_GOLD, DOJI_GOLD
- **Schedule:** 4x daily (9am, 12pm, 3pm, 6pm ICT)
- **Logic:**
  1. Fetch `webgia.com` HTML
  2. Parse table rows (deno-dom)
  3. Handle hex obfuscation (webgia anti-scraping)
  4. Extract bid/ask per symbol
  5. UPSERT to `prices` table

**crawl-gasoline-vn**
- **Source:** Petrolimex data via webgia.com
- **Symbols:** RON95, RON98, DIESEL
- **Schedule:** Daily 10am ICT
- **Logic:** Similar to gold crawler, different table structure

**crawl-silver-vn**
- **Status:** Placeholder (no active data source)
- **Symbol:** PNJ_SILVER
- **Schedule:** Not active

#### B. API Crawlers (World Commodities)

**crawl-oil-world**
- **Source:** Yahoo Finance v8 chart API
- **Tickers:** CL=F (WTI), BZ=F (Brent)
- **Schedule:** Weekdays 10pm UTC (after US market close)
- **Logic:**
  1. Fetch chart data from Yahoo v8 API
  2. Extract regularMarketPrice
  3. UPSERT as WTI_USD, BRENT_USD

**crawl-metals-world**
- **Source:** Yahoo Finance v8 chart API
- **Tickers:** GC=F (Gold), SI=F (Silver)
- **Schedule:** Weekdays every 4 hours
- **Logic:** Similar to oil crawler, map GC=F → XAU_USD, SI=F → XAG_USD

**crawl-gasoline-world**
- **Source:** Yahoo Finance v8 chart API
- **Ticker:** RB=F (RBOB)
- **Schedule:** Weekdays 10pm UTC
- **Logic:** Fetch RB=F chart, store as RBOB_USD

### 2. Shared Utilities

**crawl-auth.ts**
- Verify CRAWL_SECRET using constant-time comparison (timingSafeEqual)
- Reject requests without valid secret (HTTP 401)
- Used by all crawlers as first check

**html-parser.ts**
- deno-dom wrapper (only module that imports deno-dom)
- `parseHTML()` — safe DOM parsing with error handling
- `extractText()` — null-safe text extraction
- `parseVNPrice()` — format Vietnamese price strings (handle commas, currency)
- `fetchWithRetry()` — HTTP fetch with 2 retry attempts, 2s backoff
- Regex fallback for fragile HTML parsing

**yahoo-finance.ts**
- `fetchYahooPrice(ticker)` — fetch latest price from Yahoo v8 chart API
- Retry logic: 2 attempts, 2s delay, 15s timeout
- Extract price from chart JSON response
- Validation: price must be numeric, positive, finite

**response-helpers.ts**
- `jsonResponse()` — JSON response with 200 status
- `errorResponse()` — JSON error response with status code
- `corsResponse()` — add CORS headers

**supabase-client.ts**
- `createServiceClient()` — Supabase client using service_role key
- `upsertPrices(records)` — INSERT ... ON CONFLICT DO NOTHING
- Deduplication via UNIQUE(symbol, fetched_at)

### 3. Data Storage Layer

**PostgreSQL `prices` Table**

| Column | Type | Constraints | Purpose |
|--------|------|-------------|---------|
| id | BIGINT | PK, auto-increment | Unique identifier |
| symbol | TEXT | NOT NULL, CHECK | Symbol (e.g., SJC_9999, WTI_USD) |
| price | NUMERIC(18,4) | NOT NULL | Latest/close price |
| bid | NUMERIC(18,4) | NULLABLE | Buy price (VN only) |
| ask | NUMERIC(18,4) | NULLABLE | Sell price (VN only) |
| unit | TEXT | NOT NULL, CHECK (VND/USD) | Currency |
| source | TEXT | NOT NULL | Data source (webgia, yahoo) |
| fetched_at | TIMESTAMPTZ | NOT NULL | Sample time (UTC) |
| created_at | TIMESTAMPTZ | DEFAULT now() | Insert time |

**Constraints:**
- `UNIQUE(symbol, fetched_at)` — one price per symbol per timestamp
- `CHECK symbol IN (...)` — whitelist of valid symbols
- `CHECK unit IN ('VND', 'USD')` — only two units

**Indexes:**
- `idx_prices_symbol_fetched(symbol, fetched_at DESC)` — range queries by symbol + date
- `idx_prices_fetched(fetched_at DESC)` — all prices at a timestamp

**RLS Policies:**
- `anon_read` — SELECT only (public read access)
- `service_write` — all operations (Edge Functions only)

### 4. API Layer (PostgREST)

**Auto-Generated Endpoints:**

```
GET /rest/v1/prices
  ├─ ?symbol=eq.SJC_9999         # Filter by symbol
  ├─ ?order=fetched_at.desc      # Order by timestamp
  └─ ?limit=10                   # Limit results

GET /rest/v1/rpc/get_latest_prices
  └─ Returns latest price per symbol (DISTINCT ON)

GET /rest/v1/rpc/get_price_history
  ├─ ?p_symbol=WTI_USD           # Symbol
  ├─ ?p_from=2025-01-01T00:00:00Z # From date (default: 7 days ago)
  └─ ?p_to=2025-03-11T00:00:00Z  # To date (default: now)
```

**Authentication:**
- Required: `apikey` header with `SUPABASE_ANON_KEY`
- RLS enforces: anon can only SELECT (read)

### 5. Scheduling Layer (GitHub Actions)

**6 Cron Workflows** (one per crawler)

Each workflow:
1. Triggers on schedule (UTC times)
2. Makes HTTP POST to Edge Function
3. Includes `x-crawl-secret` header
4. Captures HTTP response status
5. Exits 1 if status ≠ 200 (failure)

**Concurrency:** `cancel-in-progress: true` prevents parallel runs

**Timeout:** 5 minutes max per run (safety limit)

---

## Data Flow Scenarios

### Scenario 1: Scheduled Gold Crawl (4x Daily)

```
12:00 PM ICT (05:00 UTC) ─► GitHub Actions cron fires
                         │
                         ├─► HTTP POST /functions/v1/crawl-gold-vn
                         │   + Authorization: Bearer {anon_key}
                         │   + x-crawl-secret: {secret}
                         │
                         ├─► Edge Function starts (Deno runtime)
                         │   1. verifyCrawlSecret() ✓
                         │   2. fetch("webgia.com/...") ✓
                         │   3. parseHTML() ✓
                         │   4. Extract 4 gold prices (bid/ask)
                         │   5. formatPriceRecord() ✓
                         │
                         ├─► Supabase service client
                         │   INSERT INTO prices (symbol, price, bid, ask, ...)
                         │   ON CONFLICT (symbol, fetched_at) DO NOTHING
                         │   └─► 4 rows inserted (SJC_9999, SJC_RING, PNJ_GOLD, DOJI_GOLD)
                         │
                         └─► HTTP 200 { success: true, count: 4 }
```

### Scenario 2: Client Reads Latest Gold Price

```
Client ──► GET /rest/v1/rpc/get_latest_prices
          + apikey: {anon_key}
          │
          ├─► PostgREST Router
          │   1. Verify apikey ✓
          │   2. Check RLS policy (anon_read) ✓
          │   3. Execute SQL:
          │      SELECT DISTINCT ON (symbol) *
          │      FROM prices
          │      ORDER BY symbol, fetched_at DESC
          │   4. Return 13 rows (one per symbol)
          │
          └─► HTTP 200 [
                { symbol: "SJC_9999", price: 8800000, bid: 8800000, ask: 8850000, ... },
                { symbol: "WTI_USD", price: 75.25, bid: null, ask: null, ... },
                ...
              ]
```

### Scenario 3: Client Queries Price History

```
Client ──► GET /rest/v1/rpc/get_price_history
          ?p_symbol=WTI_USD&p_from=2025-01-01T00:00:00Z
          + apikey: {anon_key}
          │
          ├─► PostgREST Router
          │   1. Verify apikey ✓
          │   2. Check RLS policy ✓
          │   3. Execute SQL with parameters:
          │      SELECT * FROM prices
          │      WHERE symbol = 'WTI_USD'
          │        AND fetched_at BETWEEN '2025-01-01' AND now()
          │      ORDER BY fetched_at DESC
          │   4. Return result set (indexed by symbol + fetched_at)
          │
          └─► HTTP 200 [
                { symbol: "WTI_USD", price: 75.25, fetched_at: "2026-03-11T22:00:00Z", ... },
                { symbol: "WTI_USD", price: 74.90, fetched_at: "2026-03-10T22:00:00Z", ... },
                ...
              ]
```

### Scenario 4: Unauthorized Crawler Request

```
Attacker ──► POST /functions/v1/crawl-gold-vn
            + Authorization: Bearer {invalid_key}
            │
            ├─► Edge Function
            │   1. verifyCrawlSecret() - header x-crawl-secret missing
            │   2. timingSafeEqual() comparison fails
            │   │
            │   └─► Return 401 Unauthorized
            │
            └─► HTTP 401 { error: "Unauthorized" }
```

---

## Deployment Architecture

### Environments

**Production:**
- Supabase project: `sotaisan` (zhgkqoftrghqofdvbidy)
- Region: Southeast Asia (Singapore)
- Database: Shared free tier PostgreSQL (500MB limit)
- Edge Functions: 6 deployed crawlers
- GitHub Actions: All 6 workflows active

**Local Development:**
- `supabase start` — local PostgreSQL + API emulator
- `supabase functions serve` — local Edge Function dev server
- Manual testing via `scripts/test-crawlers.sh`

### Deployment Process

**Database:**
1. `supabase link --project-ref <ref>` — link to remote
2. `supabase db push` — apply migrations
3. Migrations auto-run in order (20260310000001, 20260310000002)

**Edge Functions:**
1. `supabase functions deploy crawl-gold-vn` — deploy one function
2. Auto-creates `/functions/v1/crawl-gold-vn` endpoint
3. Deploy all 6 crawlers

**Environment Secrets:**
1. `supabase secrets set CRAWL_SECRET=...` — Edge Function secret
2. GitHub Actions secrets: SUPABASE_URL, SUPABASE_ANON_KEY, CRAWL_SECRET

**GitHub Workflows:**
1. Commit `.github/workflows/*.yml` to repo
2. GitHub auto-detects cron schedules
3. Workflows run on schedule without manual setup

---

## Security Architecture

### Authentication & Authorization

**Layer 1: Edge Function Auth**
- CRAWL_SECRET verified via `timingSafeEqual()` (constant-time)
- Prevents timing attacks (always take ~same time regardless of secret)
- Only crawlers have this secret, clients don't

**Layer 2: Database Auth**
- service_role key (in Edge Function env, never exposed)
- anon key (in GitHub Actions, public)

**Layer 3: RLS Policies**
- anon: SELECT only (read-only)
- service_role: all operations (write)

**Layer 4: Network**
- HTTPS only (Supabase enforces TLS)
- API key in header (not URL parameter)

### Data Protection

**In Transit:**
- TLS 1.2+ (Supabase)
- Signed CRAWL_SECRET validation

**At Rest:**
- PostgreSQL encryption (free tier included)
- Supabase automated backups (7-day retention)

**Secrets Management:**
- GitHub Actions secrets (encrypted, masked in logs)
- Supabase secrets (environment variables, not in code)
- Never commit `.env` files

### Rate Limiting

**Yahoo Finance API:**
- ~5,000 requests/day (public tier)
- Crawlers use ~6 requests/day (within limit)

**Supabase Edge Functions:**
- 125,000 invocations/month free (6 crawlers × 20 runs/day ≈ 3,600/month)

**PostgREST API:**
- No explicit rate limit (free tier)
- Anon key can be revoked if abused

---

## Performance Characteristics

### Query Performance

| Query | Index Used | Est. Time |
|-------|-----------|-----------|
| Latest price per symbol | idx_prices_symbol_fetched | <5ms |
| Price history (symbol + 7d range) | idx_prices_symbol_fetched | <50ms |
| All prices at timestamp | idx_prices_fetched | <100ms |

**Assumptions:** <100k rows in prices table (~6 months of data)

### Crawl Performance

| Crawler | Time | Network | Parse | Store |
|---------|------|---------|-------|-------|
| crawl-gold-vn | ~2s | 0.5s | 1s | 0.5s |
| crawl-oil-world | ~1s | 0.3s | 0s | 0.5s |
| crawl-metals-world | ~1s | 0.3s | 0s | 0.5s |

**Bottleneck:** HTML parsing (deno-dom is slower than native parsers)

### Database Size

**Estimates (6 months data):**
- Gold VN: 4 symbols × 4 crawls/day × 180 days = 2,880 rows
- Gasoline VN: 3 symbols × 1 crawl/day × 180 days = 540 rows
- Oil world: 2 symbols × 5 crawls/week × 26 weeks = 260 rows
- Metals world: 2 symbols × 20 crawls/week × 26 weeks = 1,040 rows
- Gasoline world: 1 symbol × 5 crawls/week × 26 weeks = 130 rows
- **Total:** ~4,850 rows, ~500KB (well under 500MB limit)

---

## Failure Modes & Recovery

### Edge Function Fails

**Causes:**
- Network timeout (fetch fails)
- Yahoo API returns invalid data
- Database connection error
- CRAWL_SECRET not set

**Detection:** GitHub Actions workflow captures HTTP status code
- HTTP 200 → success
- HTTP 401 → auth failed
- HTTP 500 → internal error

**Recovery:**
- Workflow logs in GitHub (visible via web UI)
- Manual retry via workflow_dispatch button
- Next scheduled run attempts again

### Data Quality Issues

**Obfuscation (webgia):**
- Hex-encoded table cells → DOM parser fails
- Fallback: regex extraction from raw text
- Last resort: skip symbol for this crawl

**Yahoo Finance timeout:**
- HTTP request takes >15s
- Abort & retry after 2s
- If both attempts fail, edge function returns 500

**Database constraint violation:**
- Duplicate (symbol, fetched_at) → ON CONFLICT DO NOTHING
- Invalid symbol → CHECK constraint prevents insert
- Invalid price (negative, NaN) → application logic rejects

---

## Scalability Considerations

### Current Limits

**Free Tier Quotas:**
- Storage: 500MB (prices table <50MB)
- Edge Function invocations: 125k/month (using ~3.6k/month)
- Database connections: 100 concurrent (crawlers use 1 each)

### Path to Scale

**If data grows 10x:**
1. Upgrade Supabase to paid tier (SQL-based billing)
2. Add data retention policy (archive old prices)
3. Partition prices table by symbol (faster index scans)
4. Add read replicas (for frequent queries)

**If crawlers grow 10x (more symbols/frequency):**
1. Distribute crawlers across multiple Edge Functions
2. Add caching layer (Redis) for latest prices
3. Batch inserts into database
4. Implement request queuing (SQS or similar)

---

## Monitoring & Observability

### What to Monitor

| Metric | Source | Alert Threshold |
|--------|--------|-----------------|
| Crawl success rate | GitHub Actions | <90% success |
| Edge Function latency | Supabase logs | >5s per run |
| Database size | Supabase console | >400MB |
| RPC query latency | PostgREST logs | >500ms |
| API key usage | Supabase console | Spike in requests |

### How to Check

**GitHub Actions:**
- View workflow runs: https://github.com/.../actions
- Check job logs for each crawl
- Look for HTTP status codes and error messages

**Supabase Console:**
- Edge Function invocations (count, duration)
- Database size and row count
- RLS policy violations

**Manual Smoke Test:**
```bash
./scripts/test-crawlers.sh
```

---

## Future Architecture Improvements

1. **Caching Layer**
   - Cache latest prices for 5 minutes
   - Reduce database queries 80%

2. **Event-Driven Crawler Coordination**
   - Replace cron with Pub/Sub (message queue)
   - Crawlers subscribe to scheduled events
   - Enable dynamic scheduling

3. **Data Warehouse**
   - Archive old prices to S3 (Parquet format)
   - Keep hot data in PostgreSQL
   - Enable data analytics

4. **Multi-Region Replication**
   - Replicate prices to regional replicas
   - Lower latency for global clients
   - Failover on primary outage

5. **GraphQL API**
   - Expose via PostgREST GraphQL layer
   - Clients can request specific fields
   - Reduce payload size

