#!/bin/bash
# Smoke test all crawlers against live Supabase instance.
# Requires: SUPABASE_URL, SUPABASE_ANON_KEY, CRAWL_SECRET env vars.
set -euo pipefail

# Validate required env vars
for var in SUPABASE_URL SUPABASE_ANON_KEY CRAWL_SECRET; do
  if [ -z "${!var:-}" ]; then
    echo "ERROR: $var is not set"
    exit 1
  fi
done

FUNCS=(
  "crawl-gold-vn"
  "crawl-silver-vn"
  "crawl-gasoline-vn"
  "crawl-oil-world"
  "crawl-metals-world"
  "crawl-gasoline-world"
)

PASSED=0
FAILED=0

echo "=== Crawler Smoke Tests ==="
echo ""

for func in "${FUNCS[@]}"; do
  echo "--- $func ---"
  RESPONSE=$(curl -s --max-time 60 --connect-timeout 10 -w "\n%{http_code}" \
    -X POST "$SUPABASE_URL/functions/v1/$func" \
    -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
    -H "x-crawl-secret: $CRAWL_SECRET" \
    -H "Content-Type: application/json")
  HTTP_CODE=$(echo "$RESPONSE" | tail -1)
  BODY=$(echo "$RESPONSE" | head -n -1)
  echo "  Status: $HTTP_CODE"
  echo "  Body: $BODY"

  if [ "$HTTP_CODE" -eq 200 ]; then
    PASSED=$((PASSED + 1))
  else
    FAILED=$((FAILED + 1))
  fi
  echo ""
done

# Test API: get_latest_prices RPC
echo "--- get_latest_prices RPC ---"
API_RESP=$(curl -s --max-time 30 \
  "$SUPABASE_URL/rest/v1/rpc/get_latest_prices" \
  -H "apikey: $SUPABASE_ANON_KEY")
COUNT=$(echo "$API_RESP" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "0")
echo "  Symbols returned: $COUNT"
echo ""

echo "=== Results: $PASSED passed, $FAILED failed ==="
if [ "$FAILED" -gt 0 ]; then
  exit 1
fi
