# API Reference

## Base URL

```
https://zhgkqoftrghqofdvbidy.supabase.co
```

## Authentication

All requests require the `apikey` header with your Supabase anon key:

```bash
-H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**For Edge Function triggers (crawlers only):**
```bash
-H "Authorization: Bearer <SUPABASE_ANON_KEY>"
-H "x-crawl-secret: <CRAWL_SECRET>"
```

---

## Prices Table (PostgREST Auto API)

### GET /rest/v1/prices

Fetch price records with filtering and pagination.

**Query Parameters:**

| Parameter | Type | Example | Notes |
|-----------|------|---------|-------|
| `select` | string | `select=symbol,price,fetched_at` | Columns to return (default: `*`) |
| `symbol` | filter | `symbol=eq.SJC_9999` | Filter by symbol (exact match) |
| `symbol` | filter | `symbol=in.(SJC_9999,PNJ_GOLD)` | Filter by multiple symbols |
| `price` | filter | `price=gt.8000000` | Filter by price (gt, gte, lt, lte) |
| `fetched_at` | filter | `fetched_at=gte.2026-01-01T00:00:00Z` | Filter by date range |
| `order` | string | `order=fetched_at.desc` | Sort by column (asc/desc) |
| `limit` | integer | `limit=10` | Max rows returned (default: 1000) |
| `offset` | integer | `offset=50` | Skip N rows (for pagination) |

**Example: Latest 10 prices for SJC_9999**

```bash
curl "https://zhgkqoftrghqofdvbidy.supabase.co/rest/v1/prices?symbol=eq.SJC_9999&order=fetched_at.desc&limit=10" \
  -H "apikey: $SUPABASE_ANON_KEY"
```

**Response:**
```json
[
  {
    "id": 1234,
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

**Example: All gold prices in last 7 days**

```bash
curl "https://zhgkqoftrghqofdvbidy.supabase.co/rest/v1/prices?symbol=in.(SJC_9999,SJC_RING,PNJ_GOLD,DOJI_GOLD)&fetched_at=gte.$(date -u -d '7 days ago' +%Y-%m-%dT%H:%M:%SZ)&order=symbol.asc,fetched_at.desc" \
  -H "apikey: $SUPABASE_ANON_KEY"
```

**Filter Operators:**

| Operator | Example | Meaning |
|----------|---------|---------|
| `eq` | `symbol=eq.SJC_9999` | equals |
| `neq` | `symbol=neq.SJC_9999` | not equals |
| `gt` | `price=gt.8000000` | greater than |
| `gte` | `price=gte.8000000` | greater than or equal |
| `lt` | `price=lt.8000000` | less than |
| `lte` | `price=lte.8000000` | less than or equal |
| `in` | `symbol=in.(SJC_9999,PNJ_GOLD)` | in list |
| `cs` | `symbol=cs.{SJC}` | contains string |
| `fts` | `symbol=fts.gold` | full-text search |

---

## RPC Functions

### GET /rest/v1/rpc/get_latest_prices

Get the latest price per symbol (most recent fetched_at).

**Parameters:** None

**Example:**

```bash
curl "https://zhgkqoftrghqofdvbidy.supabase.co/rest/v1/rpc/get_latest_prices" \
  -H "apikey: $SUPABASE_ANON_KEY"
```

**Response:**
```json
[
  {
    "id": 1234,
    "symbol": "SJC_9999",
    "price": 8800000,
    "bid": 8800000,
    "ask": 8850000,
    "unit": "VND",
    "source": "webgia.com",
    "fetched_at": "2026-03-11T02:15:00Z",
    "created_at": "2026-03-11T02:15:00Z"
  },
  {
    "id": 1235,
    "symbol": "SJC_RING",
    "price": 8750000,
    "bid": 8750000,
    "ask": 8800000,
    "unit": "VND",
    "source": "webgia.com",
    "fetched_at": "2026-03-11T02:15:00Z",
    "created_at": "2026-03-11T02:15:00Z"
  },
  ...
  // 13 rows total (one per symbol)
]
```

---

### GET /rest/v1/rpc/get_price_history

Get price history for a symbol within a date range.

**Parameters:**

| Parameter | Type | Default | Example |
|-----------|------|---------|---------|
| `p_symbol` | TEXT | required | `p_symbol=WTI_USD` |
| `p_from` | TIMESTAMPTZ | now() - 7 days | `p_from=2026-01-01T00:00:00Z` |
| `p_to` | TIMESTAMPTZ | now() | `p_to=2026-03-11T23:59:59Z` |

**Example: WTI oil price history for last 30 days**

```bash
curl "https://zhgkqoftrghqofdvbidy.supabase.co/rest/v1/rpc/get_price_history?p_symbol=WTI_USD&p_from=$(date -u -d '30 days ago' +%Y-%m-%dT%H:%M:%SZ)" \
  -H "apikey: $SUPABASE_ANON_KEY"
```

**Response:**
```json
[
  {
    "id": 5678,
    "symbol": "WTI_USD",
    "price": 75.25,
    "bid": null,
    "ask": null,
    "unit": "USD",
    "source": "yahoo",
    "fetched_at": "2026-03-11T22:00:00Z",
    "created_at": "2026-03-11T22:00:00Z"
  },
  {
    "id": 5677,
    "symbol": "WTI_USD",
    "price": 74.90,
    "bid": null,
    "ask": null,
    "unit": "USD",
    "source": "yahoo",
    "fetched_at": "2026-03-10T22:00:00Z",
    "created_at": "2026-03-10T22:00:00Z"
  },
  ...
]
```

---

### POST /functions/v1/crawl-gold-vn

Trigger Vietnamese gold price crawler (SJC, PNJ, DOJI).

**Authentication:**
```bash
-H "Authorization: Bearer $SUPABASE_ANON_KEY"
-H "x-crawl-secret: $CRAWL_SECRET"
```

**Schedule:** 0 2,5,8,11 * * * UTC (9am, 12pm, 3pm, 6pm ICT)

**Example:**

```bash
curl -X POST "https://zhgkqoftrghqofdvbidy.supabase.co/functions/v1/crawl-gold-vn" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "x-crawl-secret: $CRAWL_SECRET" \
  -H "Content-Type: application/json"
```

**Success Response (HTTP 200):**
```json
{
  "success": true,
  "count": 4,
  "message": "Gold prices stored",
  "symbols": ["SJC_9999", "SJC_RING", "PNJ_GOLD", "DOJI_GOLD"]
}
```

**Error Response (HTTP 401):**
```json
{
  "error": "Unauthorized"
}
```

**Error Response (HTTP 500):**
```json
{
  "error": "Failed to parse HTML"
}
```

---

### POST /functions/v1/crawl-gasoline-vn

Trigger Vietnamese gasoline price crawler (RON95, RON98, Diesel).

**Authentication:** Same as crawl-gold-vn

**Schedule:** 0 3 * * * UTC (10am ICT daily)

**Example:**

```bash
curl -X POST "https://zhgkqoftrghqofdvbidy.supabase.co/functions/v1/crawl-gasoline-vn" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "x-crawl-secret: $CRAWL_SECRET"
```

**Success Response:**
```json
{
  "success": true,
  "count": 3,
  "message": "Gasoline prices stored",
  "symbols": ["RON95", "RON98", "DIESEL"]
}
```

---

### POST /functions/v1/crawl-oil-world

Trigger world oil price crawler (WTI, Brent).

**Authentication:** Same as crawl-gold-vn

**Schedule:** 0 22 * * 1-5 UTC (weekdays after US market close)

**Example:**

```bash
curl -X POST "https://zhgkqoftrghqofdvbidy.supabase.co/functions/v1/crawl-oil-world" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "x-crawl-secret: $CRAWL_SECRET"
```

**Success Response:**
```json
{
  "success": true,
  "count": 2,
  "message": "Oil prices stored",
  "symbols": ["WTI_USD", "BRENT_USD"]
}
```

---

### POST /functions/v1/crawl-metals-world

Trigger world metals price crawler (XAU, XAG).

**Authentication:** Same as crawl-gold-vn

**Schedule:** 0 */4 * * 1-5 UTC (weekdays every 4 hours)

**Example:**

```bash
curl -X POST "https://zhgkqoftrghqofdvbidy.supabase.co/functions/v1/crawl-metals-world" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "x-crawl-secret: $CRAWL_SECRET"
```

**Success Response:**
```json
{
  "success": true,
  "count": 2,
  "message": "Metals prices stored",
  "symbols": ["XAU_USD", "XAG_USD"]
}
```

---

### POST /functions/v1/crawl-gasoline-world

Trigger world gasoline price crawler (RBOB).

**Authentication:** Same as crawl-gold-vn

**Schedule:** 0 22 * * 1-5 UTC (weekdays after US market close)

**Example:**

```bash
curl -X POST "https://zhgkqoftrghqofdvbidy.supabase.co/functions/v1/crawl-gasoline-world" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "x-crawl-secret: $CRAWL_SECRET"
```

**Success Response:**
```json
{
  "success": true,
  "count": 1,
  "message": "Gasoline prices stored",
  "symbols": ["RBOB_USD"]
}
```

---

## Data Types & Formats

### Price Record

```typescript
interface PriceRecord {
  id: number;              // Unique identifier
  symbol: string;          // e.g., "SJC_9999", "WTI_USD"
  price: number;           // Latest/close price
  bid: number | null;      // Buy price (VN only, null for world prices)
  ask: number | null;      // Sell price (VN only, null for world prices)
  unit: string;            // "VND" or "USD"
  source: string;          // "webgia.com" or "yahoo"
  fetched_at: string;      // ISO 8601 timestamp (UTC)
  created_at: string;      // ISO 8601 timestamp (UTC)
}
```

### Symbol Reference

**Vietnamese Gold:**
- `SJC_9999` — SJC 99.9% gold bar
- `SJC_RING` — SJC gold ring
- `PNJ_GOLD` — PNJ gold
- `DOJI_GOLD` — DOJI gold

**Vietnamese Gasoline:**
- `RON95` — Petrolimex RON95
- `RON98` — Petrolimex RON98
- `DIESEL` — Petrolimex Diesel

**World Oil (USD/barrel):**
- `WTI_USD` — West Texas Intermediate
- `BRENT_USD` — Brent Crude

**World Metals (USD/troy oz):**
- `XAU_USD` — Gold
- `XAG_USD` — Silver

**World Gasoline (USD/gallon):**
- `RBOB_USD` — RBOB (reformulated gasoline blend)

---

## Common Use Cases

### Use Case 1: Display Latest Gold Prices on Dashboard

```javascript
async function getLatestGoldPrices() {
  const response = await fetch(
    "https://zhgkqoftrghqofdvbidy.supabase.co/rest/v1/prices?" +
    "symbol=in.(SJC_9999,SJC_RING,PNJ_GOLD,DOJI_GOLD)" +
    "&order=symbol.asc",
    {
      headers: {
        apikey: "YOUR_ANON_KEY"
      }
    }
  );
  return await response.json();
}
```

### Use Case 2: Track WTI Oil Price Trend (Last 30 Days)

```javascript
async function getOilTrend() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString();

  const response = await fetch(
    "https://zhgkqoftrghqofdvbidy.supabase.co/rest/v1/rpc/get_price_history" +
    "?p_symbol=WTI_USD" +
    "&p_from=" + thirtyDaysAgo,
    {
      headers: {
        apikey: "YOUR_ANON_KEY"
      }
    }
  );
  return await response.json();
}
```

### Use Case 3: Get Price Change Percentage (24h)

```javascript
async function getPriceChange24h(symbol) {
  const now = new Date();
  const yesterday = new Date(now - 24 * 60 * 60 * 1000);

  const response = await fetch(
    "https://zhgkqoftrghqofdvbidy.supabase.co/rest/v1/rpc/get_price_history" +
    "?p_symbol=" + symbol +
    "&p_from=" + yesterday.toISOString() +
    "&p_to=" + now.toISOString(),
    {
      headers: {
        apikey: "YOUR_ANON_KEY"
      }
    }
  );

  const prices = await response.json();
  if (prices.length < 2) return null;

  const oldPrice = prices[prices.length - 1].price;
  const newPrice = prices[0].price;
  const change = ((newPrice - oldPrice) / oldPrice) * 100;

  return {
    symbol,
    oldPrice,
    newPrice,
    changePercent: change.toFixed(2)
  };
}
```

### Use Case 4: Trigger Manual Crawl

```bash
# Manually trigger gold crawler
curl -X POST "https://zhgkqoftrghqofdvbidy.supabase.co/functions/v1/crawl-gold-vn" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "x-crawl-secret: $CRAWL_SECRET" \
  -H "Content-Type: application/json" \
  -d "{}"
```

---

## Error Handling

### HTTP Status Codes

| Code | Meaning | Example |
|------|---------|---------|
| 200 | Success | Crawl completed, API returned data |
| 400 | Bad request | Invalid filter syntax, missing required param |
| 401 | Unauthorized | Invalid or missing apikey/CRAWL_SECRET |
| 404 | Not found | Endpoint doesn't exist |
| 500 | Server error | Database error, crawler failure |

### Example Error Responses

**Invalid symbol filter:**
```bash
curl "https://zhgkqoftrghqofdvbidy.supabase.co/rest/v1/prices?symbol=eq.INVALID_SYMBOL" \
  -H "apikey: $SUPABASE_ANON_KEY"
```

Response: HTTP 200 (empty array)
```json
[]
```

**Missing apikey:**
```bash
curl "https://zhgkqoftrghqofdvbidy.supabase.co/rest/v1/prices"
```

Response: HTTP 401
```json
{
  "code": "PGRST301",
  "message": "No matching REST endpoint found"
}
```

**Crawler auth failed:**
```bash
curl -X POST "https://zhgkqoftrghqofdvbidy.supabase.co/functions/v1/crawl-gold-vn" \
  -H "Authorization: Bearer invalid_key"
```

Response: HTTP 401
```json
{
  "error": "Unauthorized"
}
```

---

## Rate Limits

**PostgREST API:**
- No explicit rate limit (free tier)
- Reasonable request volume expected
- Large batch queries should use limit/offset pagination

**Edge Functions (crawlers):**
- 125,000 invocations/month free tier
- Current usage: ~3,600/month (well under limit)

**Yahoo Finance:**
- ~5,000 requests/day (public tier)
- Crawlers use ~6/day (within limit)

---

## Pagination

For large result sets, use `limit` and `offset`:

```bash
# Get first 50 records
curl "https://zhgkqoftrghqofdvbidy.supabase.co/rest/v1/prices?limit=50&offset=0" \
  -H "apikey: $SUPABASE_ANON_KEY"

# Get next 50 records
curl "https://zhgkqoftrghqofdvbidy.supabase.co/rest/v1/prices?limit=50&offset=50" \
  -H "apikey: $SUPABASE_ANON_KEY"
```

---

## Tips & Best Practices

1. **Cache Results:** Latest prices don't change every second. Cache for 5-10 minutes.
2. **Use Specific Selects:** Use `select=` to request only needed columns (faster).
3. **Filter on Server:** Use query filters instead of filtering in client code.
4. **Index on Queries:** Common queries on symbol + date use existing indexes.
5. **Timezone:** All timestamps are UTC (ISO 8601). Convert in client code.
6. **Null Values:** `bid` and `ask` are null for world prices (use `price` instead).

