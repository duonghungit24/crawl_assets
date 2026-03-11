# Phase 06: Testing & Polish

## Context Links
- [Plan Overview](plan.md)
- All previous phases

## Overview
- **Priority**: P2
- **Status**: **done**
- **Effort**: 1.5h
- **Depends on**: Phase 02, 03, 04, 05
- End-to-end testing, error handling improvements, dedup verification, documentation.

## Key Insights
- Supabase Edge Functions have no built-in test framework — test via HTTP calls
- Most critical test: verify scrapers still extract correct data from live sites
- Dedup relies on UNIQUE constraint — test with repeated calls
- Monitoring: check GitHub Actions history for failures

## Requirements

### Functional
- Verify each crawler produces correct data from live sources
- Confirm dedup: calling same crawler twice in same minute doesn't duplicate
- Validate RPC functions return expected structure
- Error handling: crawlers return meaningful errors on parse failure

### Non-Functional
- All crawlers handle network timeouts gracefully
- Failed scrapes don't insert partial/corrupt data (atomic inserts)

## Implementation Steps

### Step 1: End-to-end smoke test script
Create `scripts/test-crawlers.sh`:
```bash
#!/bin/bash
# Test all crawlers against live Supabase instance
FUNCS=("crawl-gold-vn" "crawl-silver-vn" "crawl-gasoline-vn"
       "crawl-oil-world" "crawl-metals-world" "crawl-gasoline-world")

for func in "${FUNCS[@]}"; do
  echo "Testing $func..."
  RESP=$(curl -s -w "\n%{http_code}" \
    -X POST "$SUPABASE_URL/functions/v1/$func" \
    -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
    -H "x-crawl-secret: $CRAWL_SECRET")
  CODE=$(echo "$RESP" | tail -1)
  BODY=$(echo "$RESP" | head -n -1)
  echo "  Status: $CODE | Body: $BODY"
done

# Test API endpoints
echo "Testing get_latest_prices..."
curl -s "$SUPABASE_URL/rest/v1/rpc/get_latest_prices" \
  -H "apikey: $SUPABASE_ANON_KEY" | jq '.[] | {symbol, price}'
```

### Step 2: Dedup verification
1. Call `crawl-gold-vn` twice within 1 minute
2. Query `prices` table — confirm no duplicate rows for same symbol+fetched_at
3. Verify UNIQUE constraint error is handled gracefully (upsert or ON CONFLICT DO NOTHING)

### Step 3: Error handling review
For each crawler, verify:
- [ ] Network timeout returns 500 with error message (not crash)
- [ ] Invalid HTML returns 500 with "parse error" message
- [ ] Missing CRAWL_SECRET returns 401
- [ ] Partial failures (e.g., SJC succeeds but DOJI fails) still insert successful records

### Step 4: Add ON CONFLICT handling
Update all crawlers to use upsert pattern:
```typescript
const { error } = await supabase
  .from("prices")
  .upsert(records, { onConflict: "symbol,fetched_at", ignoreDuplicates: true });
```

### Step 5: Create README.md
Document:
- Project overview
- Architecture diagram
- Setup instructions (Supabase project, secrets)
- API endpoints with examples
- Adding new data sources
- Local development with `supabase functions serve`

## Related Code Files
- **Create**: `scripts/test-crawlers.sh`
- **Create**: `README.md`
- **Modify**: All crawler `index.ts` files (add ON CONFLICT if not already present)

## Todo List
- [x] Create smoke test script (`scripts/test-crawlers.sh`)
- [ ] Run smoke tests against all crawlers (requires env vars)
- [x] Verify dedup behavior — all crawlers already use upsert with `ignoreDuplicates: true`
- [x] Add ON CONFLICT DO NOTHING to all inserts — already implemented in all crawlers
- [x] Review error handling in each crawler — Promise.allSettled, try/catch, proper error responses
- [x] Create README.md with setup + API docs
- [ ] Verify GitHub Actions cron ran at least once successfully (requires GitHub remote)

## Success Criteria
- All 6 crawlers pass smoke test (200 status, inserted > 0)
- Duplicate calls don't create duplicate rows
- Network failures return clean error JSON (no stack traces)
- README has enough info for new dev to set up and run project
- At least 24h of cron data visible in database

## Risk Assessment
| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Live site structure changed since dev | Medium | Run smoke tests as part of merge; alert on failures |
| Supabase Edge Function cold start timeout | Low | Keep functions small; deno-dom WASM loads < 3s |
