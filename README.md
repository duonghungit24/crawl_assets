# Commodity Price API

Crawl Vietnamese + international commodity prices on schedule, store in PostgreSQL, expose via Supabase PostgREST auto API. Zero cost (all free tier).

## Architecture

```
GitHub Actions (cron) --> HTTP POST --> Supabase Edge Functions
Edge Functions --> scrape HTML / fetch API --> UPSERT into PostgreSQL
Client app --> Supabase PostgREST API --> PostgreSQL (read)
```

## Data Sources

| Data | Symbols | Source | Method |
|------|---------|--------|--------|
| Gold VN | SJC_9999, SJC_RING, PNJ_GOLD, DOJI_GOLD | webgia.com | HTML scraping |
| Silver VN | PNJ_SILVER | (placeholder) | — |
| Gasoline VN | RON95, RON98, DIESEL | Petrolimex via webgia.com | HTML scraping |
| Oil World | WTI_USD, BRENT_USD | Yahoo Finance Chart API | JSON |
| Metals World | XAU_USD, XAG_USD | Yahoo Finance Chart API | JSON |
| Gasoline World | RBOB_USD | Yahoo Finance Chart API | JSON |

## Schedules (GitHub Actions Cron)

| Crawler | Cron (UTC) | Local Time |
|---------|-----------|------------|
| crawl-gold-vn | `0 2,5,8,11 * * *` | 9am, 12pm, 3pm, 6pm ICT |
| crawl-silver-vn | `0 5,11 * * *` | 12pm, 6pm ICT |
| crawl-gasoline-vn | `0 3 * * *` | 10am ICT daily |
| crawl-oil-world | `0 22 * * 1-5` | Weekdays after US close |
| crawl-metals-world | `0 */4 * * 1-5` | Every 4h weekdays |
| crawl-gasoline-world | `0 22 * * 1-5` | Weekdays after US close |

## API Endpoints

Base URL: `https://<project-ref>.supabase.co`

### Read prices (PostgREST auto API)

```bash
# All prices
curl "$SUPABASE_URL/rest/v1/prices?select=*" -H "apikey: $SUPABASE_ANON_KEY"

# Filter by symbol
curl "$SUPABASE_URL/rest/v1/prices?symbol=eq.SJC_9999&order=fetched_at.desc&limit=10" \
  -H "apikey: $SUPABASE_ANON_KEY"

# Latest price per symbol (RPC)
curl "$SUPABASE_URL/rest/v1/rpc/get_latest_prices" -H "apikey: $SUPABASE_ANON_KEY"
```

### Trigger crawlers (Edge Functions)

```bash
curl -X POST "$SUPABASE_URL/functions/v1/crawl-gold-vn" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "x-crawl-secret: $CRAWL_SECRET"
```

## Setup

### Prerequisites
- [Supabase CLI](https://supabase.com/docs/guides/cli)
- Deno (for local Edge Function development)

### 1. Link Supabase project

```bash
supabase link --project-ref <your-project-ref>
```

### 2. Run migrations

```bash
supabase db push
```

### 3. Deploy Edge Functions

```bash
supabase functions deploy crawl-gold-vn
supabase functions deploy crawl-silver-vn
supabase functions deploy crawl-gasoline-vn
supabase functions deploy crawl-oil-world
supabase functions deploy crawl-metals-world
supabase functions deploy crawl-gasoline-world
```

### 4. Set secrets

```bash
supabase secrets set CRAWL_SECRET=your-secret-here
```

### 5. GitHub Actions secrets

Add to repository Settings > Secrets:
- `SUPABASE_URL` — your Supabase project URL
- `SUPABASE_ANON_KEY` — your Supabase anon key
- `CRAWL_SECRET` — same value as Edge Function secret

### 6. Smoke test

```bash
export SUPABASE_URL=https://<ref>.supabase.co
export SUPABASE_ANON_KEY=<anon-key>
export CRAWL_SECRET=<secret>
./scripts/test-crawlers.sh
```

## Local Development

```bash
supabase start
supabase functions serve crawl-gold-vn --env-file supabase/.env.local
```

## Project Structure

```
supabase/
├── migrations/          # DB schema (prices table, RLS, RPC)
├── functions/
│   ├── _shared/         # Shared utilities
│   │   ├── crawl-auth.ts        # Auth verification
│   │   ├── html-parser.ts       # HTML parsing (deno-dom)
│   │   ├── yahoo-finance.ts     # Yahoo Finance API client
│   │   ├── response-helpers.ts  # HTTP response helpers
│   │   └── supabase-client.ts   # Supabase service client
│   ├── crawl-gold-vn/       # SJC, PNJ, DOJI gold
│   ├── crawl-silver-vn/     # Placeholder
│   ├── crawl-gasoline-vn/   # Petrolimex RON95/98, Diesel
│   ├── crawl-oil-world/     # WTI, Brent via Yahoo
│   ├── crawl-metals-world/  # XAU, XAG via Yahoo
│   └── crawl-gasoline-world/ # RBOB via Yahoo
.github/workflows/           # Cron triggers for each crawler
scripts/test-crawlers.sh     # Smoke test script
```
