# Commodity Price Crawling API — Project Overview & PDR

## Project Vision

Build a zero-cost, fully-automated commodity price crawling system that:
- Aggregates Vietnamese + international commodity prices on schedule
- Stores time-series data in a fast, queryable database
- Exposes a REST API for client applications to read latest prices

**Target Cost:** $0/month (all free tier services)

## Business Context

### Problem
- Vietnamese commodity traders need real-time gold, silver, gasoline prices
- International commodity prices (oil, metals, gasoline) are volatile and need tracking
- Manual data collection is slow and error-prone

### Solution
Automated crawling via GitHub Actions cron triggers, with persistent time-series storage and REST API access.

---

## Technical Requirements

### Functional Requirements

**FR-1: Vietnamese Commodity Price Crawling**
- Extract gold prices (SJC, PNJ, DOJI) from webgia.com HTML tables
- Extract gasoline prices (RON95, RON98, Diesel) from Petrolimex data via webgia.com
- Schedule: Gold 4x daily (9am, 12pm, 3pm, 6pm ICT), Gasoline daily 10am ICT
- Handle anti-scraping obfuscation (hex-encoded table cells)
- Acceptance: All 4 gold symbols + 3 gas symbols parsed, stored with bid/ask

**FR-2: International Commodity Price Crawling**
- Fetch oil prices (WTI, Brent) via Yahoo Finance chart API
- Fetch precious metals (XAU, XAG) via Yahoo Finance chart API
- Fetch US gasoline (RBOB) via Yahoo Finance chart API
- Schedule: Weekdays after US market close (10pm UTC)
- Acceptance: All 5 symbols fetched, stored with latest market prices

**FR-3: Time-Series Price Storage**
- Store prices with symbol, price, bid/ask, unit (VND/USD), source, fetched_at timestamp
- Deduplicate: Only store unique (symbol, fetched_at) combinations
- Retention: Keep full history indefinitely
- Acceptance: Prices queryable by symbol + date range, latest per symbol

**FR-4: REST API Exposure**
- Public read-only API (PostgREST auto-generated)
- Latest prices per symbol via RPC function
- Price history queries by symbol + date range
- Authentication: Anon key for reads, service_role for writes only
- Acceptance: All endpoints accessible, return valid JSON, support filtering

**FR-5: Scheduling & Orchestration**
- GitHub Actions cron triggers (6 workflows, UTC times configurable)
- Manual trigger via workflow_dispatch
- Timeout protection (5 minutes max per run)
- Failure notifications via HTTP status codes
- Acceptance: All workflows execute on schedule, retry on network failure

### Non-Functional Requirements

**NFR-1: Security**
- CRAWL_SECRET verified via constant-time comparison (timingSafeEqual)
- Edge Function auth: x-crawl-secret header or Bearer token
- Database RLS: anon read-only, service_role write-only
- GitHub Actions: minimal permissions ({}), secrets encrypted
- Acceptance: No unauthorized writes, timing attacks fail

**NFR-2: Reliability**
- HTML parsing: retry logic with 2-second backoff (max 2 attempts)
- Yahoo Finance: retry on timeout/network error, abort after 15s
- Database: UPSERT (on conflict do nothing) for dedup
- Acceptance: 95%+ successful crawl runs

**NFR-3: Performance**
- HTML parsing: deno-dom for fast DOM traversal
- Yahoo API: direct v8 chart endpoint (no redirects)
- Database indexes: symbol + fetched_at (DESC) for range queries
- Acceptance: Crawl completes in <5 min, query latency <100ms

**NFR-4: Cost**
- Supabase free tier: 500MB storage (prices table <50MB for 6mo data)
- GitHub Actions: unlimited minutes in public repo
- Edge Functions: 125k/month requests (6 crawlers × 4-24 runs/day ≈ 1.5k/month)
- Acceptance: No paid services required

---

## Architecture Overview

### System Flow

```
GitHub Actions (UTC cron)
    ↓ [HTTP POST + secret]
Supabase Edge Functions (Deno/TS)
    ├─ [HTML scraping + auth] → PostgreSQL UPSERT
    └─ [Yahoo API fetch] → PostgreSQL UPSERT
    ↓
PostgreSQL `prices` table
    ↓
Supabase PostgREST API (auto-generated)
    ↓
Client Applications [REST + anon key]
```

### Key Design Decisions

| Decision | Rationale | Trade-off |
|----------|-----------|-----------|
| Single `prices` table | All symbols in one place, simple RPC queries | No separate indexes per data source |
| PostgREST auto API | Zero maintenance, instant CRUD endpoints | Limited query flexibility |
| Edge Functions for writes | Isolate crawling logic, prevent DB bloat | Cold start latency (ignored for cron) |
| GitHub Actions cron | Free tier, no external scheduler | UTC times, cannot adjust per-symbol |
| deno-dom for HTML | Works in Deno/Edge Functions | ~50KB bundle overhead |
| Yahoo Finance v8 API | No API key required, public endpoint | Rate limiting (5k req/day), no SLA |

---

## Data Model

### `prices` Table

| Column | Type | Constraints | Purpose |
|--------|------|-------------|---------|
| `id` | BIGINT | PK, auto-increment | Unique identifier |
| `symbol` | TEXT | NOT NULL, CHECK list | Commodity symbol (e.g. SJC_9999) |
| `price` | NUMERIC(18,4) | NOT NULL | Latest or close price |
| `bid` | NUMERIC(18,4) | NULLABLE | Bid price (buy) |
| `ask` | NUMERIC(18,4) | NULLABLE | Ask price (sell) |
| `unit` | TEXT | NOT NULL, CHECK (VND/USD) | Currency unit |
| `source` | TEXT | NOT NULL | Data source (webgia, yahoo) |
| `fetched_at` | TIMESTAMPTZ | NOT NULL | Sample time (UTC) |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | Record insert time |

### Unique Constraint
`UNIQUE(symbol, fetched_at)` — prevent duplicate timestamps per symbol.

### Indexes
- `idx_prices_symbol_fetched(symbol, fetched_at DESC)` — range queries by symbol + date
- `idx_prices_fetched(fetched_at DESC)` — all prices at a timestamp

### RLS Policies
- `anon_read`: SELECT only (public read access)
- `service_write`: INSERT/UPDATE/DELETE (Edge Functions only)

---

## RPC Functions

### `get_latest_prices()`
Returns latest price record per symbol (DISTINCT ON).

```sql
SELECT * FROM prices
ORDER BY symbol, fetched_at DESC
LIMIT 1 per symbol
```

**Usage:** GET `/rest/v1/rpc/get_latest_prices`

### `get_price_history(symbol TEXT, from TIMESTAMPTZ, to TIMESTAMPTZ)`
Returns price history for a symbol within date range.

**Defaults:** from = now() - 7 days, to = now()

**Usage:** GET `/rest/v1/rpc/get_price_history?p_symbol=SJC_9999&p_from=2025-01-01T00:00:00Z&p_to=2025-03-11T00:00:00Z`

---

## Data Sources & Symbols

| Category | Symbols | Source | Frequency | Unit |
|----------|---------|--------|-----------|------|
| Gold VN | SJC_9999, SJC_RING, PNJ_GOLD, DOJI_GOLD | webgia.com | 4x/day (9am,12pm,3pm,6pm ICT) | VND |
| Silver VN | PNJ_SILVER | placeholder (not active) | — | VND |
| Gasoline VN | RON95, RON98, DIESEL | Petrolimex via webgia.com | 1x/day (10am ICT) | VND |
| Oil World | WTI_USD, BRENT_USD | Yahoo Finance (CL=F, BZ=F) | Weekdays 10pm UTC | USD |
| Metals World | XAU_USD, XAG_USD | Yahoo Finance (GC=F, SI=F) | Weekdays every 4h | USD |
| Gasoline World | RBOB_USD | Yahoo Finance (RB=F) | Weekdays 10pm UTC | USD |

---

## Deployment Status

### Phase Completion
- [x] **Phase 1-2**: VN commodity price crawlers (gold, gasoline)
- [x] **Phase 3**: World commodity price crawlers (oil, metals)
- [x] **Phase 4**: RPC functions, API configuration
- [x] **Phase 5**: GitHub Actions workflows
- [x] **Phase 6**: Testing & Polish

**Current Status:** Production-ready, all 6 crawlers active.

---

## API Examples

### Read Latest Prices (All Symbols)

```bash
curl "$SUPABASE_URL/rest/v1/rpc/get_latest_prices" \
  -H "apikey: $SUPABASE_ANON_KEY"
```

Response:
```json
[
  {
    "id": 1,
    "symbol": "SJC_9999",
    "price": 8800000,
    "bid": 8800000,
    "ask": 8850000,
    "unit": "VND",
    "source": "webgia.com",
    "fetched_at": "2026-03-11T02:15:00Z",
    "created_at": "2026-03-11T02:15:00Z"
  },
  ...
]
```

### Query Prices by Symbol & Date

```bash
curl "$SUPABASE_URL/rest/v1/prices?symbol=eq.SJC_9999&order=fetched_at.desc&limit=10" \
  -H "apikey: $SUPABASE_ANON_KEY"
```

### Get Price History (RPC)

```bash
curl "$SUPABASE_URL/rest/v1/rpc/get_price_history?p_symbol=WTI_USD" \
  -H "apikey: $SUPABASE_ANON_KEY"
```

---

## Success Metrics

- **Crawl Success Rate:** ≥95% (measured by GitHub Actions workflow success)
- **API Availability:** ≥99.5% (Supabase SLA)
- **Data Freshness:** Latest price <4 hours old per symbol
- **Cost:** $0 (all free tier)
- **Database Size:** <100MB (6mo @ 1000 prices/day)

---

## Future Enhancements

1. **Additional Data Sources**
   - Crypto prices (Bitcoin, Ethereum) via CoinGecko API
   - Agricultural prices (rice, coffee) via custom crawlers

2. **Analytics & Insights**
   - Price change percentage (24h, 7d, 30d)
   - Moving averages (7d, 30d)
   - Volume-weighted metrics

3. **Notifications**
   - Webhook alerts on price movements >threshold
   - Email/Telegram notifications for traders

4. **Admin Dashboard**
   - Crawler status monitoring
   - Manual trigger UI
   - Data quality checks (missing prices, outliers)

---

## Known Limitations

1. **Yahoo Finance Rate Limits:** 5k requests/day, no SLA (may fail during market volatility)
2. **Webgia Anti-Scraping:** Hex obfuscation makes parsing fragile (regex-based fallback)
3. **UTC Scheduling:** GitHub Actions cron in UTC only, no per-timezone control
4. **Silver VN:** Currently placeholder, no active crawler (waiting for data source)

---

## Contact & Support

- **Repository:** https://github.com/duonghungit24/crawl_assets
- **Issues:** Report via GitHub Issues
- **Monitoring:** Check GitHub Actions workflow runs for status
