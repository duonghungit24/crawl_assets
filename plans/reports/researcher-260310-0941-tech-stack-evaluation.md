# Tech Stack Evaluation: Commodity Price Crawling API

## Final Decision: Supabase-based Stack

**Platform:** Supabase (PostgreSQL + Edge Functions + PostgREST) | **Scheduler:** GitHub Actions cron | **Scraper:** deno-dom + fetch | **Cost:** $0/mo

> Originally evaluated Node.js + Fastify + BullMQ + Redis + Drizzle (self-hosted). Switched to Supabase after user requested managed hosting with zero infrastructure.

---

## Why Supabase over Self-hosted

| Factor | Self-hosted (Fastify) | Supabase (chosen) |
|--------|----------------------|-------------------|
| API code | Custom Fastify routes | Zero code (PostgREST auto) |
| DB management | Self-managed PostgreSQL | Managed, free tier |
| Scheduling | BullMQ + Redis ($6/mo VPS) | GitHub Actions cron ($0) |
| Deployment | Docker + VPS | `supabase functions deploy` |
| Cost | ~$6-15/mo | $0/mo |
| Maintenance | Server updates, backups | Zero |

## Final Stack Breakdown

| Component | Choice | Why |
|-----------|--------|-----|
| Database | Supabase PostgreSQL | Managed, free 500MB, auto backups |
| API | PostgREST (auto-generated) | Zero code, filtering/pagination built-in |
| Crawlers | Supabase Edge Functions (Deno/TS) | Serverless, deploy via CLI |
| HTML Parser | deno-dom | Deno-native, no npm shim needed |
| HTTP Client | Deno fetch (built-in) | No external dependency |
| Scheduling | GitHub Actions cron | Free, reliable, separate schedules |
| Auth | RLS + CRAWL_SECRET header | Read-only for apps, write for crawlers |

## Architecture

```
GitHub Actions (cron) --> HTTP POST --> Supabase Edge Functions
Edge Functions --> scrape HTML / fetch API --> INSERT into PostgreSQL
Client app --> Supabase PostgREST API --> PostgreSQL (read)
```

## Data Sources (ALL FREE)

| Data | Source | Method | Cost |
|------|--------|--------|------|
| Gold VN | SJC, PNJ, DOJI | Scrape HTML | $0 |
| Silver VN | PNJ, DOJI | Scrape HTML | $0 |
| Gasoline VN | Petrolimex | Scrape HTML | $0 |
| Oil (WTI/Brent) | EIA API | JSON API | $0 |
| Gold world (XAU) | Yahoo Finance | Scrape HTML | $0 |
| Silver world (XAG) | Yahoo Finance | Scrape HTML | $0 |
| Gasoline world (RBOB) | EIA API | JSON API | $0 |

## Trade-offs

- **No TimescaleDB** — Supabase doesn't support it. Use BRIN index on timestamp instead. Fine for small-medium data volume.
- **Edge Functions = Deno** — Not Node.js. Most npm packages unavailable directly. deno-dom replaces cheerio.
- **GitHub Actions cron delay** — Up to 15 min delay. Acceptable for commodity prices (not real-time trading).
- **Yahoo Finance scraping** — May block. Fallback: goldapi.io free tier (6 req/day).

## Resolved Questions

- VN data sources: SJC, PNJ, DOJI (gold), Petrolimex (gasoline) — all HTML scraping
- World data: EIA API (oil/gasoline), Yahoo Finance (metals) — free
- Cost: $0/mo total (Supabase free + GitHub Actions free + all data sources free)
