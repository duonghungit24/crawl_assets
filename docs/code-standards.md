# Code Standards & Codebase Structure

## Project Overview

**Commodity Price Crawling API** — Deno/TypeScript Edge Functions on Supabase, crawling commodity prices via HTML scraping and API calls, storing in PostgreSQL, exposing via PostgREST.

**Tech Stack:**
- Runtime: Deno (TypeScript)
- Database: Supabase PostgreSQL
- API Gateway: Supabase Edge Functions
- HTML Parser: deno-dom
- Scheduling: GitHub Actions cron
- Authentication: timingSafeEqual (constant-time comparison)

---

## Directory Structure

```
supabase/
├── migrations/
│   ├── 20260310000001_create_prices_table.sql
│   └── 20260310000002_create_rpc_functions.sql
├── functions/
│   ├── _shared/
│   │   ├── crawl-auth.ts              # Auth verification (timingSafeEqual)
│   │   ├── html-parser.ts             # HTML parsing + retry logic
│   │   ├── yahoo-finance.ts           # Yahoo Finance API client
│   │   ├── response-helpers.ts        # HTTP response utility functions
│   │   └── supabase-client.ts         # Supabase service client
│   ├── crawl-gold-vn/
│   │   └── index.ts                   # Gold crawler (SJC, PNJ, DOJI)
│   ├── crawl-silver-vn/
│   │   └── index.ts                   # Silver crawler (placeholder)
│   ├── crawl-gasoline-vn/
│   │   └── index.ts                   # Gasoline crawler (RON95/98, Diesel)
│   ├── crawl-oil-world/
│   │   └── index.ts                   # Oil crawler (WTI, Brent)
│   ├── crawl-metals-world/
│   │   └── index.ts                   # Metals crawler (XAU, XAG)
│   └── crawl-gasoline-world/
│       └── index.ts                   # Gasoline crawler (RBOB)
├── config.toml                         # Supabase config
└── .gitignore

.github/
└── workflows/
    ├── crawl-gold-vn.yml
    ├── crawl-silver-vn.yml
    ├── crawl-gasoline-vn.yml
    ├── crawl-oil-world.yml
    ├── crawl-metals-world.yml
    └── crawl-gasoline-world.yml

scripts/
└── test-crawlers.sh                   # Smoke test (manual trigger + verify)

.env.example                           # Environment variables template
README.md                              # Project README
```

---

## TypeScript/Deno Code Standards

### Imports & Dependencies

**Import Order:**
1. Deno std library (`https://deno.land/std@...`)
2. External packages (npm, deno.land)
3. Relative imports (`../`, `./`)

```typescript
import { timingSafeEqual } from "https://deno.land/std@0.224.0/crypto/timing_safe_equal.ts";
import { parseHTML, extractText } from "../_shared/html-parser.ts";
import { createServiceClient } from "../_shared/supabase-client.ts";
```

**No npm packages in Edge Functions** (deno-dom only exception for HTML parsing).

### Naming Conventions

| Type | Convention | Example |
|------|-----------|---------|
| Functions | camelCase | `parseVNPrice()`, `fetchWithRetry()` |
| Classes | PascalCase | `PriceRecord`, `CrawlResponse` |
| Constants | UPPER_SNAKE_CASE | `CHART_API_BASE`, `TIMEOUT_MS` |
| Variables | camelCase | `priceRecord`, `symbolList` |
| Files | kebab-case (functions), index.ts | `html-parser.ts`, `yahoo-finance.ts` |
| Types/Interfaces | PascalCase | `PriceRecord`, `CrawlOptions` |

### Type Definitions

**Always define explicit types for function parameters and return values:**

```typescript
// Good
function parseVNPrice(text: string): number {
  return parseFloat(text.replace(/,/g, ""));
}

// Bad (implicit any)
function parseVNPrice(text) {
  return parseFloat(text.replace(/,/g, ""));
}
```

**Use interfaces for complex objects:**

```typescript
interface PriceRecord {
  symbol: string;
  price: number;
  bid: number | null;
  ask: number | null;
  unit: string;
  source: string;
  fetched_at: string;
}
```

### Error Handling

**Always use try-catch for external calls (HTTP, database):**

```typescript
try {
  const res = await fetch(url, { signal: controller.signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
} catch (err) {
  console.error(`Fetch failed: ${err}`);
  throw new Error(`Failed to fetch: ${err}`);
}
```

**Retry logic with exponential backoff:**

```typescript
for (let attempt = 0; attempt < 2; attempt++) {
  try {
    // attempt operation
    return result;
  } catch (err) {
    if (attempt === 0) {
      console.warn(`Attempt 1 failed: ${err}. Retrying...`);
      await new Promise((r) => setTimeout(r, 2000));
    } else {
      throw err;
    }
  }
}
```

### Authentication

**All Edge Functions must verify CRAWL_SECRET:**

```typescript
import { verifyCrawlSecret } from "../_shared/crawl-auth.ts";

export async function handler(req: Request): Promise<Response> {
  // First line: auth check
  const authError = verifyCrawlSecret(req);
  if (authError) return authError;

  // Continue with crawling logic
}
```

**Use constant-time comparison (timingSafeEqual) — never `===` for secrets:**

```typescript
const encoder = new TextEncoder();
const a = encoder.encode(secret);
const b = encoder.encode(provided);
if (a.length !== b.length || !timingSafeEqual(a, b)) {
  return unauthorized();
}
```

### Comments & Documentation

**Required comments:**
- Complex parsing logic
- Workarounds for data source issues
- Known limitations

**Example:**

```typescript
// Webgia anti-scraping: hex-encodes some cells
// Fallback to regex if DOM parser fails
function isObfuscated(el: Element): boolean {
  const cls = el.getAttribute("class") ?? "";
  return cls.includes("bgvtk") || cls.includes("gvd");
}
```

**Avoid comments for obvious code:**

```typescript
// Bad: obvious from function name
const price = parseFloat(text); // convert text to number

// Good: explains why
const price = parseFloat(text); // Yahoo API returns string, need numeric
```

### Async/Await

**Always use async/await, never `.then()` chains:**

```typescript
// Good
async function crawl(): Promise<void> {
  const html = await fetch(url).then(r => r.text());
  const prices = await parseHTML(html);
  await saveToDatabase(prices);
}

// Bad (promise chain)
function crawl(): Promise<void> {
  return fetch(url).then(r => r.text()).then(html => parseHTML(html));
}
```

### Response Format

**All Edge Functions return JSON:**

```typescript
export async function handler(req: Request): Promise<Response> {
  return new Response(
    JSON.stringify({
      success: true,
      count: 5,
      message: "Crawl completed"
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );
}
```

**Error responses:**

```typescript
return new Response(
  JSON.stringify({ error: "Invalid input" }),
  { status: 400, headers: { "Content-Type": "application/json" } }
);
```

---

## HTML Parsing Standards

### deno-dom Usage

**Parse HTML with error handling:**

```typescript
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.48/deno-dom-wasm.ts";

function parseHTML(html: string): Document {
  try {
    return new DOMParser().parseFromString(html, "text/html") ?? new Document();
  } catch (err) {
    console.error("DOM parse error: " + err);
    throw new Error("Failed to parse HTML");
  }
}
```

**Extract text safely:**

```typescript
function extractText(el: Element | null): string {
  return el?.textContent?.trim() ?? "";
}
```

**Selector fallbacks (for fragile HTML):**

```typescript
function getTableRows(doc: Document): Element[] {
  const selectors = [
    "table.table-radius tbody tr",
    "table.table-radius tr",
    "table tbody tr",
    "table tr",
  ];
  for (const sel of selectors) {
    const rows = doc?.querySelectorAll(sel) ?? [];
    const dataRows = [...rows].filter(r => r.querySelectorAll("td").length >= 2);
    if (dataRows.length > 0) return dataRows;
  }
  return [];
}
```

---

## Database Standards (PostgreSQL)

### Migrations

**File naming:** `YYYYMMDDHHMMSS_description_in_snake_case.sql`

**Always include:**
- Explicit column types (no SERIAL unless needed)
- Constraints (NOT NULL, UNIQUE, CHECK)
- Indexes for common queries
- RLS policies for multi-tenant tables

**Example:**

```sql
CREATE TABLE prices (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  symbol TEXT NOT NULL CHECK (symbol IN (...)),
  price NUMERIC(18,4) NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(symbol, fetched_at)
);

CREATE INDEX idx_prices_symbol_fetched ON prices(symbol, fetched_at DESC);

ALTER TABLE prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read" ON prices FOR SELECT TO anon USING (true);
```

### RPC Functions

**Use `RETURNS SETOF table_name` for multiple rows:**

```sql
CREATE OR REPLACE FUNCTION get_latest_prices()
RETURNS SETOF prices AS $$
  SELECT DISTINCT ON (symbol) *
  FROM prices
  ORDER BY symbol, fetched_at DESC;
$$ LANGUAGE sql STABLE;

GRANT EXECUTE ON FUNCTION get_latest_prices() TO anon;
```

**Use parameters for filtering:**

```sql
CREATE OR REPLACE FUNCTION get_price_history(
  p_symbol TEXT,
  p_from TIMESTAMPTZ DEFAULT now() - INTERVAL '7 days',
  p_to TIMESTAMPTZ DEFAULT now()
)
RETURNS SETOF prices AS $$
  SELECT * FROM prices
  WHERE symbol = p_symbol AND fetched_at BETWEEN p_from AND p_to
  ORDER BY fetched_at DESC;
$$ LANGUAGE sql STABLE;
```

---

## Shared Utilities (`_shared/`)

### `crawl-auth.ts`
- **Purpose:** Auth verification for all crawlers
- **Exported:** `verifyCrawlSecret(req: Request): Response | null`
- **Usage:** Must be first line in all Edge Function handlers

### `html-parser.ts`
- **Purpose:** HTML parsing + retry logic + Vietnamese price parsing
- **Exported:** `parseHTML()`, `extractText()`, `parseVNPrice()`, `fetchWithRetry()`, `verifyCrawlSecret()`
- **Dependencies:** deno-dom (only module with DOM dependency)

### `yahoo-finance.ts`
- **Purpose:** Yahoo Finance chart API client
- **Exported:** `fetchYahooPrice(ticker: string): Promise<number>`
- **Usage:** World commodity crawlers (oil, metals, gasoline)
- **Retry:** 2 attempts with 2s delay, 15s timeout

### `response-helpers.ts`
- **Purpose:** HTTP response construction
- **Exported:** `jsonResponse()`, `errorResponse()`, `corsResponse()`

### `supabase-client.ts`
- **Purpose:** Supabase service client (writes only)
- **Exported:** `createServiceClient()`, `upsertPrices()`
- **Auth:** service_role key from environment

---

## GitHub Actions Workflow Standards

### Naming
- Pattern: `{crawler-name}.yml`
- Example: `crawl-gold-vn.yml`

### Structure

```yaml
name: Crawl Gold VN

on:
  schedule:
    - cron: "0 2,5,8,11 * * *"  # Times in UTC
  workflow_dispatch:              # Allow manual trigger

permissions: {}                    # Minimal permissions

concurrency:
  group: ${{ github.workflow }}   # Prevent parallel runs
  cancel-in-progress: true

jobs:
  crawl:
    runs-on: ubuntu-latest
    timeout-minutes: 5             # Safety timeout
    steps:
      - name: Trigger Edge Function
        run: |
          # HTTP POST with secret, capture status code
          # Exit 1 if status != 200
```

### Secrets Used
- `SUPABASE_URL` — project URL
- `SUPABASE_ANON_KEY` — anon key
- `CRAWL_SECRET` — crawler auth secret

---

## Testing Standards

### Manual Testing (test-crawlers.sh)

**Run locally:**

```bash
export SUPABASE_URL=https://...supabase.co
export SUPABASE_ANON_KEY=...
export CRAWL_SECRET=...
./scripts/test-crawlers.sh
```

**Checks:**
- All 6 crawlers trigger successfully (HTTP 200)
- Prices stored in database
- No duplicate timestamps per symbol

### What to Test After Changes

| Change | Test |
|--------|------|
| HTML selector change | Verify webgia data parsed correctly |
| Yahoo API change | Verify world prices fetch + store |
| DB schema change | Run migrations locally, verify RPC works |
| Auth logic change | Verify invalid secret rejected (HTTP 401) |

---

## Security Standards

### Secrets Management

**Never commit:**
- `.env` files
- API keys or auth tokens
- Private database credentials

**Use GitHub Actions secrets for:**
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `CRAWL_SECRET`

**Use Supabase secrets for:**
- Edge Function env vars (set via `supabase secrets set`)

### Authentication

**All Edge Functions must:**
1. Call `verifyCrawlSecret(req)` first
2. Reject requests without valid secret (HTTP 401)
3. Use constant-time comparison (timingSafeEqual)

**Database:**
- RLS enabled on all user tables
- anon role: read-only (SELECT)
- service_role: write-only (via Edge Functions)

### Data Validation

**Always validate external input:**

```typescript
// Check symbol before inserting
const validSymbols = [
  "SJC_9999", "SJC_RING", "PNJ_GOLD", "DOJI_GOLD",
  "WTI_USD", "BRENT_USD", "XAU_USD", "XAG_USD", "RBOB_USD"
];
if (!validSymbols.includes(symbol)) {
  throw new Error(`Invalid symbol: ${symbol}`);
}
```

---

## Performance Guidelines

### Optimization

| Concern | Standard |
|---------|----------|
| HTML parsing | Use querySelectorAll once, cache rows |
| API calls | Parallel fetch for unrelated symbols |
| Database | Use indexes on (symbol, fetched_at) |
| Timeouts | Abort requests after 15s (Yahoo), 30s (HTML) |

### Monitoring

**Check GitHub Actions:**
- Workflow success/failure rate
- Run duration (target: <2 min per crawler)

**Check Supabase:**
- Edge Function invocations (should be 4-24 per day per crawler)
- Database size (prices table growth)

---

## Common Patterns

### Pattern: Retry with Backoff

```typescript
async function fetchWithRetry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 2,
  delayMs: number = 2000
): Promise<T> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i < maxAttempts - 1) {
        console.warn(`Attempt ${i + 1} failed: ${err}. Retrying...`);
        await new Promise(r => setTimeout(r, delayMs));
      } else {
        throw err;
      }
    }
  }
  throw new Error("Unreachable");
}
```

### Pattern: UPSERT (dedup by timestamp)

```sql
INSERT INTO prices (symbol, price, bid, ask, unit, source, fetched_at, created_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, now())
ON CONFLICT (symbol, fetched_at) DO NOTHING;
```

### Pattern: Extract from HTML with Fallback

```typescript
// Try DOM selector, fallback to regex
function extractPrice(td: Element | null): number | null {
  const text = td?.textContent?.trim() ?? "";
  try {
    return parseFloat(text.replace(/,/g, ""));
  } catch {
    const match = text.match(/[\d,.]+/);
    return match ? parseFloat(match[0].replace(/,/g, "")) : null;
  }
}
```

---

## Linting & Formatting

**No strict linting enforced** (keep it simple for rapid iteration).

**Guidelines:**
- Avoid syntax errors (TypeScript compiler catches most)
- Use meaningful variable names (self-documenting)
- Keep functions under 50 lines (split long functions)
- Add comments for non-obvious logic

---

## Documentation Within Code

**Every Edge Function should have:**

```typescript
// Edge Function: {description}
// Input: {describe request format}
// Output: {describe response format}
// Auth: CRAWL_SECRET required (x-crawl-secret header)
// Schedule: {cron or manual}

export async function handler(req: Request): Promise<Response> {
  // ...
}
```

**Example:**

```typescript
// Edge Function: Crawl Vietnamese gold prices from SJC, PNJ, DOJI via webgia.com
// Input: POST with x-crawl-secret header
// Output: JSON { success: true, count: 4, message: "..." }
// Auth: CRAWL_SECRET required
// Schedule: 0 2,5,8,11 * * * (9am, 12pm, 3pm, 6pm ICT)

export async function handler(req: Request): Response {
  const authError = verifyCrawlSecret(req);
  if (authError) return authError;
  // ...
}
```

---

## Version Control

### Commit Messages

**Format:** `{type}: {description}`

Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`

**Examples:**
- `feat: add world metals crawler (XAU, XAG)`
- `fix: handle webgia hex obfuscation in gold crawler`
- `docs: update API documentation`

### Branches

**Main branch:** `main` (production)
- Only merge PRs with passing tests
- Require code review

**Feature branches:** `feature/{feature-name}`
- Keep focused on one change
- Delete after merge

