# Deployment & Operations Guide

## Prerequisites

- [Supabase CLI](https://supabase.com/docs/guides/cli) (v1.60+)
- Deno (optional, for local development)
- Git
- GitHub repository access

---

## Initial Setup (One-Time)

### Step 1: Link to Supabase Project

```bash
supabase link --project-ref zhgkqoftrghqofdvbidy
```

**Verify:**
```bash
supabase status
```

Output should show:
```
Supabase API: https://zhgkqoftrghqofdvbidy.supabase.co
Database: PostgreSQL
```

### Step 2: Deploy Database Schema

```bash
supabase db push
```

This runs migrations in order:
1. `20260310000001_create_prices_table.sql` — creates table, indexes, RLS
2. `20260310000002_create_rpc_functions.sql` — creates RPC functions

**Verify:**
```bash
supabase db list-tables
```

Should show `prices` table with columns: id, symbol, price, bid, ask, unit, source, fetched_at, created_at

### Step 3: Deploy Edge Functions

Deploy each crawler:

```bash
# Deploy all crawlers at once
supabase functions deploy crawl-gold-vn
supabase functions deploy crawl-silver-vn
supabase functions deploy crawl-gasoline-vn
supabase functions deploy crawl-oil-world
supabase functions deploy crawl-metals-world
supabase functions deploy crawl-gasoline-world
```

**Verify:**
```bash
supabase functions list
```

Should show 6 functions with status `Active`.

### Step 4: Set Supabase Secrets

Set the CRAWL_SECRET used by Edge Functions:

```bash
supabase secrets set CRAWL_SECRET=your-secret-here
```

**Verify:**
```bash
supabase secrets list
```

### Step 5: Configure GitHub Actions Secrets

Add repository secrets for GitHub Actions workflows:

1. Go to GitHub repo Settings > Secrets and variables > Actions
2. Add three secrets:
   - `SUPABASE_URL` = `https://zhgkqoftrghqofdvbidy.supabase.co`
   - `SUPABASE_ANON_KEY` = your anon key (from Supabase project settings)
   - `CRAWL_SECRET` = same value as Step 4

**Get SUPABASE_ANON_KEY:**
```bash
supabase projects api-keys --project-ref zhgkqoftrghqofdvbidy
```

Look for key with role `anon` (starts with `eyJhbGci...`).

### Step 6: Verify Workflows Are Active

Check `.github/workflows/` — should have 6 workflow files:
- `crawl-gold-vn.yml`
- `crawl-silver-vn.yml`
- `crawl-gasoline-vn.yml`
- `crawl-oil-world.yml`
- `crawl-metals-world.yml`
- `crawl-gasoline-world.yml`

Go to GitHub repo > Actions tab — all workflows should appear in the list.

### Step 7: Test All Crawlers

Run smoke test locally:

```bash
export SUPABASE_URL=https://zhgkqoftrghqofdvbidy.supabase.co
export SUPABASE_ANON_KEY=<your-anon-key>
export CRAWL_SECRET=<your-secret>
./scripts/test-crawlers.sh
```

**Expected output:**
```
Testing crawl-gold-vn... HTTP 200 ✓
Testing crawl-silver-vn... HTTP 200 ✓
Testing crawl-gasoline-vn... HTTP 200 ✓
Testing crawl-oil-world... HTTP 200 ✓
Testing crawl-metals-world... HTTP 200 ✓
Testing crawl-gasoline-world... HTTP 200 ✓
All crawlers passed!
```

---

## Local Development Setup

### Start Local Supabase

```bash
supabase start
```

This starts:
- PostgreSQL (port 54321)
- PostgREST API (port 3000)
- Supabase Studio (port 5173)

**First time:** Supabase pulls Docker image and initializes database (~2 min).

### Run Edge Function Locally

```bash
supabase functions serve crawl-gold-vn --env-file supabase/.env.local
```

This starts a development server on `http://localhost:54321/functions/v1/crawl-gold-vn`.

**Test locally:**
```bash
curl -X POST http://localhost:54321/functions/v1/crawl-gold-vn \
  -H "Authorization: Bearer test-key" \
  -H "x-crawl-secret: test-secret" \
  -H "Content-Type: application/json"
```

### Check Local Data

```bash
# Connect to local PostgreSQL
psql 'postgresql://postgres:postgres@localhost:54321/postgres'

# Query prices table
SELECT symbol, price, bid, ask, fetched_at FROM prices ORDER BY fetched_at DESC LIMIT 5;
```

### Stop Local Environment

```bash
supabase stop
```

---

## Ongoing Operations

### Monitoring Crawl Runs

**GitHub Actions:**

1. Go to GitHub repo > Actions tab
2. Click workflow name (e.g., "Crawl Gold VN")
3. View recent runs — green checkmark = success, red X = failure
4. Click run to see logs

**Log Format:**
```
Trigger Edge Function
Status: 200
Response: {"success":true,"count":4,"message":"Gold prices stored"}
```

**Common Status Codes:**
- 200 = Success
- 401 = Auth failed (CRAWL_SECRET invalid or missing)
- 500 = Internal error (see Edge Function logs)

### Checking Database

**Supabase Console:**
1. Go to https://supabase.com/dashboard
2. Select project > SQL Editor
3. Run:
   ```sql
   SELECT symbol, COUNT(*) as count, MAX(fetched_at) as latest
   FROM prices
   GROUP BY symbol
   ORDER BY symbol;
   ```

This shows last crawl time per symbol.

**Check for data quality:**
```sql
-- Find symbols with missing recent data (>4 hours old)
SELECT symbol, MAX(fetched_at) as latest_fetch, NOW() - MAX(fetched_at) as age
FROM prices
WHERE fetched_at > NOW() - INTERVAL '7 days'
GROUP BY symbol
HAVING NOW() - MAX(fetched_at) > INTERVAL '4 hours'
ORDER BY age DESC;
```

### Manual Crawl Trigger

**Via GitHub UI:**
1. Go to Actions > click workflow (e.g., "Crawl Gold VN")
2. Click "Run workflow" > select branch > click green "Run workflow"

**Via API:**
```bash
curl -X POST https://api.github.com/repos/{owner}/{repo}/actions/workflows/{workflow-id}/dispatches \
  -H "Authorization: token $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  -d '{"ref":"main"}'
```

### Verify API Works

Test PostgREST API:

```bash
# Latest prices
curl "https://zhgkqoftrghqofdvbidy.supabase.co/rest/v1/rpc/get_latest_prices" \
  -H "apikey: $SUPABASE_ANON_KEY" | jq .

# Price history
curl "https://zhgkqoftrghqofdvbidy.supabase.co/rest/v1/rpc/get_price_history?p_symbol=WTI_USD" \
  -H "apikey: $SUPABASE_ANON_KEY" | jq .

# Filter by symbol
curl "https://zhgkqoftrghqofdvbidy.supabase.co/rest/v1/prices?symbol=eq.SJC_9999&limit=5&order=fetched_at.desc" \
  -H "apikey: $SUPABASE_ANON_KEY" | jq .
```

---

## Troubleshooting

### Crawl Fails with HTTP 401 (Unauthorized)

**Cause:** CRAWL_SECRET invalid or not set.

**Fix:**
1. Verify Supabase secret is set:
   ```bash
   supabase secrets list
   ```
2. Verify GitHub Actions secrets:
   - Go to Settings > Secrets and variables > Actions
   - Check `CRAWL_SECRET` value matches Supabase secret
3. Re-deploy Edge Function:
   ```bash
   supabase functions deploy crawl-gold-vn
   ```

### Crawl Fails with HTTP 500 (Internal Error)

**Cause:** Network error, parsing failure, or database error.

**Debug:**
1. Check Edge Function logs:
   ```bash
   supabase functions list --project-id <ref>
   ```
2. Manually test in local environment:
   ```bash
   supabase start
   supabase functions serve crawl-gold-vn --env-file supabase/.env.local
   # In another terminal:
   curl -X POST http://localhost:54321/functions/v1/crawl-gold-vn \
     -H "x-crawl-secret: test-secret" -H "Authorization: Bearer test"
   ```
3. Check if source website is accessible:
   ```bash
   curl -s https://webgia.com/ | head -20
   ```

### No Data Appearing in Database

**Check crawl ran:**
- GitHub Actions workflow shows green checkmark?
- Status code was 200?

**Check RLS policy:**
```bash
psql 'postgresql://postgres:postgres@localhost:54321/postgres'
SELECT * FROM prices LIMIT 1;
```

If no rows, check if INSERT is working:
```bash
-- Run as postgres (admin)
INSERT INTO prices (symbol, price, unit, source, fetched_at)
VALUES ('TEST_SYMBOL', 100, 'VND', 'test', NOW());
```

### API Returns 401 Unauthorized

**Cause:** apikey header missing or invalid.

**Fix:**
```bash
# Verify key
SUPABASE_ANON_KEY=$(supabase projects api-keys --project-ref zhgkqoftrghqofdvbidy | grep anon | awk '{print $NF}')

# Test
curl "https://zhgkqoftrghqofdvbidy.supabase.co/rest/v1/prices?limit=1" \
  -H "apikey: $SUPABASE_ANON_KEY"
```

### Yahoo Finance API Fails

**Cause:** Rate limit exceeded or API endpoint changed.

**Check:**
1. Yahoo Finance might rate-limit after 5k requests/day
2. Check if endpoint is reachable:
   ```bash
   curl "https://query2.finance.yahoo.com/v8/finance/chart/CL=F?interval=1d&range=1d" | jq .
   ```
3. Verify ticker symbol is valid (CL=F for WTI, BZ=F for Brent, etc.)

**Workaround:**
- Crawlers have retry logic (2 attempts, 2s delay)
- Next scheduled run will try again

### Webgia Website Parsing Fails

**Cause:** Website layout changed or anti-scraping obfuscation updated.

**Debug:**
1. Check if webgia.com is accessible:
   ```bash
   curl -s https://webgia.com/ | grep -i gold | head -5
   ```
2. Download HTML and inspect:
   ```bash
   curl -s https://webgia.com/ > /tmp/webgia.html
   # Open in browser: open /tmp/webgia.html
   ```
3. Check table structure — may need to update CSS selectors in `html-parser.ts`

**Fix:**
1. Update selectors in `crawl-gold-vn/index.ts` or `html-parser.ts`
2. Test locally:
   ```bash
   supabase start
   supabase functions serve crawl-gold-vn
   ```
3. Commit & push changes
4. Re-deploy:
   ```bash
   supabase functions deploy crawl-gold-vn
   ```

---

## Maintenance Tasks

### Weekly Checks

- [ ] All 6 workflows showing green checkmarks in GitHub Actions
- [ ] Latest prices appear in database (no symbols missing >4 hours)
- [ ] No errors in Edge Function logs

**Command:**
```bash
# Quick health check
curl -s "https://zhgkqoftrghqofdvbidy.supabase.co/rest/v1/rpc/get_latest_prices" \
  -H "apikey: $SUPABASE_ANON_KEY" | jq 'length'
# Should return 13 (if all crawlers working)
```

### Monthly Checks

- [ ] Database size is under 100MB (check Supabase console)
- [ ] No failed crawls in last 30 days
- [ ] API response times under 200ms

**Database size:**
```bash
psql 'postgresql://postgres:postgres@localhost:54321/postgres' -c \
  "SELECT pg_size_pretty(pg_total_relation_size('prices'));"
```

### Quarterly Tasks

- [ ] Review and update data retention policy (archive old prices if needed)
- [ ] Test disaster recovery (can we restore from backup?)
- [ ] Update crawler logic if data sources change

---

## Scaling & Optimization

### Add New Crawler

1. Create function directory:
   ```bash
   mkdir supabase/functions/crawl-{name}
   ```

2. Create `index.ts` with crawler logic (follow existing pattern)

3. Add symbol to price table CHECK constraint (modify migration)

4. Deploy function:
   ```bash
   supabase functions deploy crawl-{name}
   ```

5. Create GitHub Actions workflow (copy existing, update cron schedule)

6. Commit & push `.github/workflows/crawl-{name}.yml`

### Optimize Database

**Add retention policy (keep last 6 months):**
```sql
DELETE FROM prices WHERE fetched_at < NOW() - INTERVAL '6 months';
-- Schedule this as a cron job (via pg_cron extension if available)
```

**Partition table (if >1M rows):**
```sql
-- Create partitions by symbol (future improvement)
ALTER TABLE prices PARTITION BY LIST (symbol);
```

### Cache Latest Prices

Use Supabase Realtime or client-side caching:

```javascript
// Client: cache latest prices for 5 minutes
let cachedPrices = null;
let cacheTime = null;

async function getLatestPrices() {
  const now = Date.now();
  if (cachedPrices && cacheTime && (now - cacheTime) < 5 * 60 * 1000) {
    return cachedPrices;
  }
  cachedPrices = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_latest_prices`, {
    headers: { apikey: SUPABASE_ANON_KEY }
  }).then(r => r.json());
  cacheTime = now;
  return cachedPrices;
}
```

---

## Backup & Recovery

### Automatic Backups

Supabase automatically backs up databases daily (7-day retention on free tier).

**Check backup status:**
1. Go to Supabase Console > Settings > Backups
2. Should show daily snapshots

### Manual Backup

Export database:

```bash
# Backup entire database
supabase db dump > backup_$(date +%Y%m%d).sql

# Restore from backup
supabase db push --file backup_20260311.sql
```

### Point-in-Time Recovery

If disaster occurs:
1. Go to Supabase Console > Settings > Backups
2. Click "Restore" next to desired snapshot
3. Choose restore time
4. Database rolls back to that point

---

## Security Considerations

### Rotate CRAWL_SECRET

Change secret every 6 months:

```bash
# Generate new secret
NEW_SECRET=$(openssl rand -hex 32)

# Update Supabase
supabase secrets set CRAWL_SECRET=$NEW_SECRET

# Update GitHub Actions
# Go to Settings > Secrets and variables > Actions
# Edit CRAWL_SECRET with new value

# Re-deploy functions
supabase functions deploy crawl-gold-vn crawl-silver-vn crawl-gasoline-vn ...
```

### Audit API Key Access

Check Supabase console for:
- API key rotation history
- Failed auth attempts
- Unusual query patterns

### Monitor for Suspicious Activity

Watch for:
- Sudden spike in API requests
- Queries returning large datasets
- Concurrent connections from unknown IPs

---

## Performance Tuning

### Database Indexes

Current indexes are optimized for typical queries. If performance degrades:

```sql
-- Add compound index if needed
CREATE INDEX idx_prices_symbol_date ON prices(symbol, DATE(fetched_at)) WHERE symbol = 'SJC_9999';

-- Check index usage
SELECT * FROM pg_stat_user_indexes WHERE schemaname = 'public';
```

### Edge Function Timeout

Current timeout: 5 minutes (configured in GitHub Actions workflows).

If crawlers consistently time out:
1. Increase timeout in workflow file (increase `timeout-minutes`)
2. Optimize HTML parsing (use faster parser if available)
3. Batch multiple crawlers into single function

### API Response Time

If API slow:
1. Check database size (may need cleanup)
2. Check for missing indexes
3. Use Supabase Analytics to identify slow queries

```sql
-- Find slow queries
SELECT query, mean_time, calls FROM pg_stat_statements
ORDER BY mean_time DESC LIMIT 10;
```

