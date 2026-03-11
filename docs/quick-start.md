# Quick Start Guide

## Get Started in 5 Minutes

This guide helps you get the API running locally and test crawlers.

---

## Prerequisites

- [Supabase CLI](https://supabase.com/docs/guides/cli)
- [Git](https://git-scm.com/)
- (Optional) Deno for local Edge Function development

---

## Option A: Test Production API (Easiest)

### Step 1: Get Your API Key

```bash
# Already set in production environment
export SUPABASE_URL=https://zhgkqoftrghqofdvbidy.supabase.co
export SUPABASE_ANON_KEY=<your-anon-key>
export CRAWL_SECRET=<your-secret>
```

### Step 2: Test Latest Prices

```bash
curl "$SUPABASE_URL/rest/v1/rpc/get_latest_prices" \
  -H "apikey: $SUPABASE_ANON_KEY" | jq .
```

You should see 13 records (one per symbol) with latest prices.

### Step 3: Query by Symbol

```bash
# Get latest 10 gold prices
curl "$SUPABASE_URL/rest/v1/prices?symbol=eq.SJC_9999&order=fetched_at.desc&limit=10" \
  -H "apikey: $SUPABASE_ANON_KEY" | jq .
```

### Step 4: Trigger Manual Crawl

```bash
# Crawl gold prices
curl -X POST "$SUPABASE_URL/functions/v1/crawl-gold-vn" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "x-crawl-secret: $CRAWL_SECRET" | jq .
```

---

## Option B: Run Locally (Full Setup)

### Step 1: Start Local Supabase

```bash
cd /Users/mesoft/Project/antigravity/assets_api
supabase start
```

First run takes ~2 minutes. On success:
```
Started supabase local development setup.

         API URL: http://localhost:54321
     Anon Key: eyJhbGc...
Service Role Key: eyJhbGc...
```

### Step 2: Apply Database Schema

```bash
supabase db push
```

This runs migrations:
1. Create prices table with indexes
2. Create RPC functions
3. Enable RLS policies

Verify:
```bash
supabase db list-tables
```

Should show `prices` table.

### Step 3: Deploy Edge Functions (Local)

```bash
# Terminal 1: Serve the gold crawler
supabase functions serve crawl-gold-vn

# Terminal 2: Test it
curl -X POST http://localhost:54321/functions/v1/crawl-gold-vn \
  -H "Authorization: Bearer test-key" \
  -H "x-crawl-secret: test-secret"
```

Response:
```json
{
  "success": true,
  "count": 4,
  "message": "Gold prices stored"
}
```

### Step 4: Query Local Database

```bash
# Connect to local PostgreSQL
psql 'postgresql://postgres:postgres@localhost:54321/postgres'

# Inside psql:
SELECT symbol, price, fetched_at FROM prices ORDER BY fetched_at DESC LIMIT 5;
```

### Step 5: Test API Endpoint

```bash
curl "http://localhost:54321/rest/v1/rpc/get_latest_prices" \
  -H "apikey: eyJhbGc..." | jq .
```

---

## Common Tasks

### Run Smoke Test

```bash
./scripts/test-crawlers.sh
```

Tests all 6 crawlers on production. Output:
```
Testing crawl-gold-vn... HTTP 200 ✓
Testing crawl-silver-vn... HTTP 200 ✓
Testing crawl-gasoline-vn... HTTP 200 ✓
Testing crawl-oil-world... HTTP 200 ✓
Testing crawl-metals-world... HTTP 200 ✓
Testing crawl-gasoline-world... HTTP 200 ✓
All crawlers passed!
```

### View Latest Prices

```bash
# All symbols
curl "$SUPABASE_URL/rest/v1/rpc/get_latest_prices" \
  -H "apikey: $SUPABASE_ANON_KEY" | jq .

# Pretty print
curl "$SUPABASE_URL/rest/v1/rpc/get_latest_prices" \
  -H "apikey: $SUPABASE_ANON_KEY" | jq -r '.[] | "\(.symbol): \(.price) \(.unit)"'
```

Output:
```
SJC_9999: 8800000 VND
SJC_RING: 8750000 VND
PNJ_GOLD: 8780000 VND
DOJI_GOLD: 8810000 VND
RON95: 18500 VND
RON98: 19500 VND
DIESEL: 17200 VND
WTI_USD: 75.25 USD
BRENT_USD: 79.50 USD
XAU_USD: 2050.00 USD
XAG_USD: 24.50 USD
RBOB_USD: 2.45 USD
PNJ_SILVER: null VND
```

### Get Price History

```bash
# Last 7 days of WTI oil
curl "$SUPABASE_URL/rest/v1/rpc/get_price_history?p_symbol=WTI_USD" \
  -H "apikey: $SUPABASE_ANON_KEY" | jq '.[] | {fetched_at, price}'
```

### Trigger Specific Crawler

```bash
# Metals
curl -X POST "$SUPABASE_URL/functions/v1/crawl-metals-world" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "x-crawl-secret: $CRAWL_SECRET"

# Gasoline VN
curl -X POST "$SUPABASE_URL/functions/v1/crawl-gasoline-vn" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "x-crawl-secret: $CRAWL_SECRET"
```

### Check Crawler Status

Go to: https://github.com/duonghungit24/crawl_assets/actions

Click on workflow (e.g., "Crawl Gold VN") to see recent runs.

---

## Symbols Reference

### Vietnamese Commodities (in VND)

**Gold:**
- `SJC_9999` — SJC 99.9% gold bar
- `SJC_RING` — SJC gold ring
- `PNJ_GOLD` — PNJ gold
- `DOJI_GOLD` — DOJI gold

**Gasoline:**
- `RON95` — Petrolimex RON95
- `RON98` — Petrolimex RON98
- `DIESEL` — Petrolimex Diesel

**Silver:**
- `PNJ_SILVER` — PNJ silver (placeholder)

### World Commodities (in USD)

**Oil (per barrel):**
- `WTI_USD` — West Texas Intermediate
- `BRENT_USD` — Brent Crude

**Metals (per troy oz):**
- `XAU_USD` — Gold
- `XAG_USD` — Silver

**Gasoline (per gallon):**
- `RBOB_USD` — RBOB blend

---

## Useful Queries

### Latest price for one symbol:

```bash
curl "$SUPABASE_URL/rest/v1/prices?symbol=eq.SJC_9999&order=fetched_at.desc&limit=1" \
  -H "apikey: $SUPABASE_ANON_KEY" | jq '.[0]'
```

### Compare prices across all gold symbols:

```bash
curl "$SUPABASE_URL/rest/v1/prices?symbol=in.(SJC_9999,SJC_RING,PNJ_GOLD,DOJI_GOLD)&order=symbol.asc,fetched_at.desc&limit=4" \
  -H "apikey: $SUPABASE_ANON_KEY" | jq 'group_by(.symbol) | .[] | {symbol: .[0].symbol, prices: map(.price)}'
```

### Price changes in last 24 hours:

```bash
# Requires manual calculation, fetch and compare oldest vs newest
curl "$SUPABASE_URL/rest/v1/rpc/get_price_history?p_symbol=WTI_USD&p_from=$(date -u -d '1 day ago' +%Y-%m-%dT%H:%M:%SZ)" \
  -H "apikey: $SUPABASE_ANON_KEY" | jq '[.[0].price, .[-1].price] | {newPrice: .[0], oldPrice: .[1], changePercent: ((.[0] - .[1]) / .[1] * 100 | tostring + "%")}'
```

---

## Troubleshooting

### "No such table: prices"

Database migrations didn't run.

**Fix:**
```bash
supabase db push
```

### "Unauthorized" (HTTP 401)

Missing or invalid apikey/secret.

**Fix:**
```bash
# Check apikey is set
echo $SUPABASE_ANON_KEY

# Check secret is correct (GitHub Actions settings)
echo $CRAWL_SECRET
```

### Crawler returns HTTP 500

Internal error (parsing, network, or database).

**Debug locally:**
```bash
supabase start
supabase functions serve crawl-gold-vn
# In another terminal:
curl -X POST http://localhost:54321/functions/v1/crawl-gold-vn \
  -H "x-crawl-secret: test-secret"
```

### Empty results from database

Crawlers haven't run yet.

**Fix:** Manually trigger:
```bash
curl -X POST "$SUPABASE_URL/functions/v1/crawl-gold-vn" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "x-crawl-secret: $CRAWL_SECRET"
```

---

## Next Steps

1. **Read Full Docs:**
   - [`project-overview-pdr.md`](./project-overview-pdr.md) — Project vision & requirements
   - [`system-architecture.md`](./system-architecture.md) — How the system works
   - [`api-reference.md`](./api-reference.md) — All API endpoints
   - [`deployment-guide.md`](./deployment-guide.md) — Production deployment

2. **Explore Code:**
   - Check `supabase/functions/` for crawler implementations
   - Read `supabase/migrations/` for database schema

3. **Integrate with Your App:**
   - Use `GET /rest/v1/rpc/get_latest_prices` for latest prices
   - Use `GET /rest/v1/rpc/get_price_history` for price history
   - Cache results for 5+ minutes

4. **Monitor Production:**
   - Check GitHub Actions for crawler runs
   - View Supabase console for data freshness
   - Set up alerts for failed crawls

---

## API Endpoint Quick Reference

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/rest/v1/rpc/get_latest_prices` | GET | Latest price per symbol |
| `/rest/v1/rpc/get_price_history` | GET | Price history (date range) |
| `/rest/v1/prices` | GET | Raw price data (filterable) |
| `/functions/v1/crawl-gold-vn` | POST | Trigger gold crawler |
| `/functions/v1/crawl-gasoline-vn` | POST | Trigger gasoline crawler |
| `/functions/v1/crawl-oil-world` | POST | Trigger oil crawler |
| `/functions/v1/crawl-metals-world` | POST | Trigger metals crawler |
| `/functions/v1/crawl-gasoline-world` | POST | Trigger world gasoline crawler |

**Base URL:** `https://zhgkqoftrghqofdvbidy.supabase.co`

**Auth Header:** `apikey: $SUPABASE_ANON_KEY`

---

## Still Have Questions?

Check the docs:
- **API Questions:** See [`api-reference.md`](./api-reference.md)
- **Deployment Issues:** See [`deployment-guide.md`](./deployment-guide.md)
- **Code Structure:** See [`code-standards.md`](./code-standards.md)
- **Architecture:** See [`system-architecture.md`](./system-architecture.md)

