---
title: "Commodity Price Crawling API"
description: "Supabase-based API crawling VN and world commodity prices on schedule"
status: pending
priority: P1
effort: 12h
branch: main
tags: [supabase, crawling, commodity-prices, edge-functions, github-actions]
created: 2026-03-10
---

# Commodity Price Crawling API

## Goal
Crawl Vietnamese + international commodity prices on schedule, store in PostgreSQL, expose via Supabase PostgREST auto API. Zero cost (all free tier).

## Tech Stack
| Layer | Technology | Role |
|-------|-----------|------|
| Database | Supabase PostgreSQL | Managed DB, free 500MB |
| API | PostgREST (auto) | Zero-code REST endpoints |
| Crawlers | Supabase Edge Functions (Deno/TS) | Serverless scrape/fetch |
| HTML Parser | deno-dom | Deno-native HTML parsing |
| Scheduling | GitHub Actions cron | Free scheduled triggers |
| Auth | RLS + CRAWL_SECRET | Read-only app, write-only crawlers |
| **Total cost** | **$0/mo** | All free tier |

## Data Sources (ALL FREE)
| Data | Source | Method |
|------|--------|--------|
| Gold VN | SJC, PNJ, DOJI | Scrape HTML |
| Silver VN | PNJ, DOJI | Scrape HTML |
| Gasoline VN | Petrolimex | Scrape HTML |
| Oil (WTI/Brent) | Yahoo Finance Chart API | JSON API |
| Gold/Silver World | Yahoo Finance Chart API | JSON API |
| Gasoline World | Yahoo Finance Chart API | JSON API |

## Architecture
```
GitHub Actions (cron) --> HTTP POST --> Supabase Edge Functions
Edge Functions --> scrape HTML / fetch API --> INSERT into PostgreSQL
Client app --> Supabase PostgREST API --> PostgreSQL (read)
```

## Symbols
| Category | Symbols |
|----------|---------|
| Gold VN | SJC_9999, SJC_RING, PNJ_GOLD, DOJI_GOLD |
| Silver VN | PNJ_SILVER |
| Gasoline VN | RON95, RON98, DIESEL |
| Gold World | XAU_USD |
| Silver World | XAG_USD |
| Oil World | WTI_USD, BRENT_USD |
| Gasoline World | RBOB_USD |

## Phases

| # | Phase | Status | Effort | File |
|---|-------|--------|--------|------|
| 1 | Setup & DB Schema | **done** | 2h | [phase-01](phase-01-setup-and-db-schema.md) |
| 2 | VN Crawlers | **done** | 3h | [phase-02](phase-02-vn-crawlers.md) |
| 3 | World Crawlers | **done** | 2.5h | [phase-03](phase-03-world-crawlers.md) |
| 4 | API & RPC | **done** | 1.5h | [phase-04](phase-04-api-and-rpc.md) |
| 5 | GitHub Actions | pending | 1.5h | [phase-05](phase-05-github-actions.md) |
| 6 | Testing & Polish | pending | 1.5h | [phase-06](phase-06-testing-and-polish.md) |

## Key Dependencies
- Supabase project (free tier) with anon key + service role key
- GitHub repo for Actions cron

## Key Decisions
- **No custom API code** — PostgREST handles all reads automatically
- **Edge Functions for writes only** — crawl + insert
- **One `prices` table** — all symbols in single table, partitioned by symbol
- **GitHub Actions for scheduling** — free, reliable, no extra infra
- **deno-dom for HTML parsing** — native Deno, no npm needed (VN crawlers only)
- **Yahoo Finance Chart API** — public JSON endpoint, no API key needed (world crawlers)
