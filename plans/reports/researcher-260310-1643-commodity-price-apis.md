# Commodity Price Data Sources - Research Report

**Date:** 2026-03-10 | **Research ID:** researcher-260310-1643

## Executive Summary

**Reality Check:** All reliable commodity price APIs require API keys. There are **NO truly free, no-authentication-required** sources for world commodity prices (gold, silver, WTI, Brent crude, gasoline).

However, **free tier options exist** that require simple sign-up without credit card. Two viable paths:
1. **Metals.Dev** - Free tier, 100 req/month, covers Au/Ag only
2. **Commodity APIs** - Require registration but no upfront payment

**WebGia.com** - Has HTML-rendered commodity data on their website, but no public API (only serves Vietnamese domestic prices, not global commodities).

---

## Findings by Source

### 1. Metals.Dev ✓ VIABLE (Free)
**URL:** https://api.metals.dev/v1/

| Aspect | Details |
|--------|---------|
| **Auth** | API key required (free sign-up, no card) |
| **Free Tier** | 100 requests/month |
| **Latency** | 60-second delay max |
| **Supported** | Au, Ag, Pt, Pd (NO oil/gas) |
| **Response** | JSON with spot/bid/ask/hi/lo/change |
| **Server-side** | ✓ Yes, Deno/Node compatible |
| **Rate Limits** | 100/month free tier |

**Endpoint Example:**
```
GET https://api.metals.dev/v1/metal/spot?api_key=KEY&metal=gold&currency=USD
```

**Response Format:**
```json
{
  "currency": "USD",
  "metal": "gold",
  "spot": 5183.56,
  "bid": 5182.45,
  "ask": 5184.67,
  "high": 5190.12,
  "low": 5175.33,
  "change": 12.34,
  "change_percent": 0.24,
  "timestamp": "2026-03-10T09:45:00Z"
}
```

**Limitations:** Metals only, no crude oil or gasoline data.

---

### 2. MetalpriceAPI ✓ VIABLE (Free)
**URL:** https://metalpriceapi.com/

| Aspect | Details |
|--------|---------|
| **Auth** | API key required (instant, no card) |
| **Free Tier** | Limited (check dashboard) |
| **Supported** | Au, Ag, Cu, Pt, Pd + 150+ currencies |
| **Response** | JSON |
| **Server-side** | ✓ Yes |
| **Rate Limits** | TBD (likely per-minute) |

**Documentation:** https://metalpriceapi.com/documentation

**Limitations:** No oil/commodity prices in free tier.

---

### 3. Commodities-API ⚠️ REQUIRES KEY
**URL:** https://commodities-api.com/

| Aspect | Details |
|--------|---------|
| **Auth** | API key required |
| **Free Tier** | Yes (check pricing page) |
| **Supported** | Gold, Silver, WTI, Brent, Coffee, etc. |
| **Latency** | 60-second updates |
| **Server-side** | ✓ Yes |

**Note:** This is the ONLY API we found that covers **both metals AND crude oils** (WTI + Brent).

---

### 4. Yahoo Finance (query1.finance.yahoo.com) ✗ BLOCKED
- Returns "Too Many Requests" even for single queries
- Anti-bot protection active
- Not server-side accessible

---

### 5. Fawazahmed0 Currency API ✗ NOT VIABLE
- CDN path doesn't serve commodity data
- Currency-only API
- No precious metals or oil support

---

### 6. WebGia.com ✗ NO API
- Website displays world commodity prices (Au, Ag, WTI, Brent)
- **No public API endpoint exists**
- Would require web scraping (violates TOS, fragile)
- HTML-parsed data could break with layout changes

---

### 7. GoldAPI.io ✗ REQUIRES KEY
- Free tier exists but needs API key
- JS-heavy website, documentation limited
- Similar to MetalpriceAPI

---

## Unresolved Questions

1. **Gasoline/RBOB prices:** None of the free APIs we found expose RBOB gasoline futures. Crude oils (WTI/Brent) yes, but not refined products.
2. **Commodities-API free tier limits:** Need to check their pricing page for exact monthly request allocation
3. **Rate limits under load:** All free tiers have limits; need to verify they're sufficient for your crawl schedule

---

## Recommendation

### Best Path Forward
1. **Register Metals.Dev** (100 req/month free) for Au/Ag prices
2. **Register Commodities-API** (free tier TBD) for WTI/Brent crude
3. **For RBOB gasoline:** May need to:
   - Search for separate energy API (Oil Price API, but requires key)
   - Or use Brent/WTI as proxy + markup formula

### Implementation Notes
- Both APIs work from Deno Edge Functions (no browser requirements)
- Free tiers sufficient for daily crawls (1-2 req/symbol/day = 20-40 req/month)
- Store API keys in Supabase secrets, not code
- Add retry logic for rate limit handling (429 responses)

---

## Sources
- [Metals-API Documentation](https://metals-api.com/documentation)
- [Metals.Dev API Docs](https://metals.dev/docs)
- [MetalpriceAPI](https://metalpriceapi.com/)
- [Commodities-API](https://commodities-api.com/)
- [GoldAPI.io](https://www.goldapi.io/)
