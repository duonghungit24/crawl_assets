# Documentation Index

## Welcome to Commodity Price Crawling API Documentation

This directory contains comprehensive documentation for the commodity price crawling system. Choose your starting point below.

---

## For Different Audiences

### I'm a Developer (Just Getting Started)

Start here:
1. **[Quick Start Guide](./quick-start.md)** — Get the API running in 5 minutes
2. **[Project Overview & PDR](./project-overview-pdr.md)** — Understand what the project does
3. **[System Architecture](./system-architecture.md)** — Learn how everything fits together
4. **[Code Standards](./code-standards.md)** — Understand the codebase structure

### I Need to Deploy or Maintain This

Start here:
1. **[Deployment Guide](./deployment-guide.md)** — Initial setup and ongoing operations
2. **[System Architecture](./system-architecture.md)** — How components interact
3. **[Code Standards](./code-standards.md)** — Where to find code

### I'm Building a Client Application

Start here:
1. **[API Reference](./api-reference.md)** — All endpoints with examples
2. **[Quick Start Guide](./quick-start.md)** — Try it out
3. **[Project Overview & PDR](./project-overview-pdr.md)** — Understand data symbols

### I Need to Add New Crawlers or Features

Start here:
1. **[Code Standards](./code-standards.md)** — Patterns and conventions
2. **[System Architecture](./system-architecture.md)** — How crawlers work
3. **[Codebase Summary](./codebase-summary.md)** — Current implementation details
4. **[Deployment Guide](./deployment-guide.md)** — How to deploy changes

---

## Documentation Files

### [quick-start.md](./quick-start.md)
**Get started in 5 minutes**

- Test production API (easiest)
- Run locally (full setup)
- Common tasks with examples
- Troubleshooting quick fixes

**Read time:** 10 minutes

### [project-overview-pdr.md](./project-overview-pdr.md)
**Project vision, requirements, and design decisions**

- Business context and goals
- Functional & non-functional requirements
- Architecture overview
- Data model and RPC functions
- Data sources and schedules
- Success metrics and future enhancements

**Read time:** 20 minutes

### [system-architecture.md](./system-architecture.md)
**Deep dive into how the system works**

- Component architecture
- Data flow scenarios
- Deployment architecture
- Security architecture
- Performance characteristics
- Failure modes and recovery
- Monitoring and observability

**Read time:** 25 minutes

### [code-standards.md](./code-standards.md)
**Coding standards and codebase structure**

- Directory structure
- TypeScript/Deno conventions
- Error handling patterns
- Authentication standards
- HTML parsing patterns
- Database standards
- Testing guidelines
- Security protocols
- Common code patterns

**Read time:** 30 minutes

### [deployment-guide.md](./deployment-guide.md)
**Setup, operations, and maintenance**

- Initial setup (7 steps)
- Local development environment
- Ongoing operations
- Troubleshooting guide
- Maintenance tasks (weekly/monthly/quarterly)
- Scaling considerations
- Backup & recovery
- Performance tuning

**Read time:** 30 minutes

### [api-reference.md](./api-reference.md)
**Complete API documentation**

- Base URL and authentication
- Prices table endpoints with filters
- RPC functions (get_latest_prices, get_price_history)
- Crawler trigger endpoints
- Data types and formats
- Symbol reference
- Common use cases with code examples
- Error handling
- Rate limits and pagination

**Read time:** 20 minutes

### [codebase-summary.md](./codebase-summary.md)
**Overview of current implementation**

- Project structure and file organization
- Key code patterns (6 examples)
- Data flow examples
- Technology stack
- Code metrics
- Testing approach
- Configuration details
- Known limitations

**Read time:** 20 minutes

---

## Quick Reference

### Common Tasks

**How do I...?**

| Task | Document | Section |
|------|----------|---------|
| Get started quickly | [Quick Start](./quick-start.md) | Top |
| Deploy to production | [Deployment Guide](./deployment-guide.md) | Initial Setup |
| Test the API | [Quick Start](./quick-start.md) | Option A |
| Run locally | [Quick Start](./quick-start.md) | Option B |
| Understand the API | [API Reference](./api-reference.md) | Top |
| Add a new crawler | [Code Standards](./code-standards.md) + [System Architecture](./system-architecture.md) | Crawler Pattern |
| Fix a bug | [Deployment Guide](./deployment-guide.md) | Troubleshooting |
| Monitor health | [Deployment Guide](./deployment-guide.md) | Ongoing Operations |
| Understand the architecture | [System Architecture](./system-architecture.md) | Top |
| Learn the code patterns | [Code Standards](./code-standards.md) | Common Patterns |

### Key Symbols

**Vietnamese (VND):**
- Gold: SJC_9999, SJC_RING, PNJ_GOLD, DOJI_GOLD
- Gasoline: RON95, RON98, DIESEL
- Silver: PNJ_SILVER (placeholder)

**World (USD):**
- Oil: WTI_USD, BRENT_USD
- Metals: XAU_USD, XAG_USD
- Gasoline: RBOB_USD

### Key URLs

**Production API:**
```
Base: https://zhgkqoftrghqofdvbidy.supabase.co
Latest prices: /rest/v1/rpc/get_latest_prices
Price history: /rest/v1/rpc/get_price_history
Trigger crawlers: /functions/v1/crawl-{name}
```

**Local Development:**
```
Base: http://localhost:54321
```

---

## Document Map (By Topic)

### Architecture & Design
- [Project Overview & PDR](./project-overview-pdr.md) — vision, requirements, decisions
- [System Architecture](./system-architecture.md) — components, data flow, deployment
- [Codebase Summary](./codebase-summary.md) — current implementation

### Implementation
- [Code Standards](./code-standards.md) — conventions, patterns, structure
- [Codebase Summary](./codebase-summary.md) — file organization, key patterns

### API Usage
- [API Reference](./api-reference.md) — endpoints, parameters, examples
- [Quick Start](./quick-start.md) — quick examples

### Operations
- [Deployment Guide](./deployment-guide.md) — setup, maintenance, troubleshooting
- [Quick Start](./quick-start.md) — local development

---

## Reading Paths by Role

### Backend Developer
1. Quick Start (Option B) — 10 min
2. Code Standards — 30 min
3. System Architecture — 25 min
4. Codebase Summary — 20 min
**Total: 85 minutes**

### DevOps / Site Reliability Engineer
1. Quick Start (Option A) — 5 min
2. Project Overview — 20 min
3. Deployment Guide — 30 min
4. System Architecture — 25 min
**Total: 80 minutes**

### Frontend / Client Developer
1. Quick Start (Option A) — 5 min
2. API Reference — 20 min
3. Common Use Cases in API Reference — 10 min
**Total: 35 minutes**

### Product Manager
1. Project Overview — 20 min
2. System Architecture (skip details) — 15 min
3. Known Limitations in Codebase Summary — 5 min
**Total: 40 minutes**

---

## Key Metrics

- **6 Crawlers** deployed and active
- **13 Symbols** tracked (4 gold, 3 gas, 1 silver, 2 oil, 2 metals, 1 gas)
- **$0/month** cost (free tier only)
- **~1,200 lines** of code
- **95%+ crawl** success rate target

---

## Status

**Current Version:** v1.0 (Production-Ready)

**All Phases Complete:**
- Phase 1-2: VN commodity crawlers ✓
- Phase 3: World commodity crawlers ✓
- Phase 4: RPC functions & API ✓
- Phase 5: GitHub Actions workflows ✓
- Phase 6: Testing & Polish ✓

**Last Updated:** 2026-03-11

---

## Feedback & Issues

- **Code Issues:** GitHub Issues (https://github.com/duonghungit24/crawl_assets)
- **Documentation Issues:** File a GitHub issue with tag `docs:`
- **Questions:** Check relevant doc first, then file an issue

---

## Navigation

- **To read about architecture:** See [System Architecture](./system-architecture.md)
- **To understand the code:** See [Code Standards](./code-standards.md) + [Codebase Summary](./codebase-summary.md)
- **To deploy:** See [Deployment Guide](./deployment-guide.md)
- **To use the API:** See [API Reference](./api-reference.md)
- **To get started:** See [Quick Start](./quick-start.md)

