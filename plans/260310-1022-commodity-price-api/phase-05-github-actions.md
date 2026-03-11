# Phase 05: GitHub Actions

## Context Links
- [Plan Overview](plan.md)
- [Phase 02: VN Crawlers](phase-02-vn-crawlers.md)
- [Phase 03: World Crawlers](phase-03-world-crawlers.md)

## Overview
- **Priority**: P2
- **Status**: **done**
- **Effort**: 1.5h
- **Depends on**: Phase 02, Phase 03
- Create GitHub Actions cron workflows to trigger Edge Functions on schedule.

## Key Insights
- GitHub Actions cron is free for public repos, 2000 min/month for private
- Each workflow run triggers one Edge Function via HTTP POST — minimal compute
- VN prices update during business hours (9am-5pm ICT = UTC+7)
- World prices: oil/gasoline = business days only; metals = 24/5
- Petrolimex gasoline prices update ~2x/month — daily check is sufficient

## Requirements

### Functional
- Cron workflows triggering each crawler group
- CRAWL_SECRET passed as header for auth
- Separate schedules for VN vs world crawlers
- Manual trigger (workflow_dispatch) for testing

### Non-Functional
- Workflow should complete in < 1 minute
- Log HTTP response status for monitoring

## Architecture

### Schedule Design
| Crawler | Cron Schedule | Rationale |
|---------|--------------|-----------|
| crawl-gold-vn | `0 2,5,8,11 * * *` (9am,12pm,3pm,6pm ICT) | VN gold updates during business hours |
| crawl-silver-vn | `0 5,11 * * *` (12pm,6pm ICT) | Less volatile, 2x/day sufficient |
| crawl-gasoline-vn | `0 3 * * *` (10am ICT daily) | Updates rarely, daily check enough |
| crawl-oil-world | `0 22 * * 1-5` (weekdays, after US market close) | EIA publishes daily close prices |
| crawl-metals-world | `0 */4 * * 1-5` (every 4h weekdays) | Metals trade 24h on weekdays |
| crawl-gasoline-world | `0 22 * * 1-5` (with oil) | Same EIA source |

### Workflow Structure
Single workflow file with multiple jobs, each on its own schedule. Or separate workflow files per crawler for independent cron schedules.

**Decision: Separate workflow files** — simpler cron management, independent failure handling.

## Related Code Files
- **Create**: `.github/workflows/crawl-gold-vn.yml` ✓ DONE
- **Create**: `.github/workflows/crawl-silver-vn.yml` ✓ DONE
- **Create**: `.github/workflows/crawl-gasoline-vn.yml` ✓ DONE
- **Create**: `.github/workflows/crawl-oil-world.yml` ✓ DONE
- **Create**: `.github/workflows/crawl-metals-world.yml` ✓ DONE
- **Create**: `.github/workflows/crawl-gasoline-world.yml` ✓ DONE

## Implementation Steps

### Step 1: Create workflow template pattern
All workflows follow same structure:
```yaml
name: Crawl Gold VN
on:
  schedule:
    - cron: "0 2,5,8,11 * * *"
  workflow_dispatch:

jobs:
  crawl:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Edge Function
        run: |
          RESPONSE=$(curl -s -w "\n%{http_code}" \
            -X POST "${{ secrets.SUPABASE_URL }}/functions/v1/crawl-gold-vn" \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_ANON_KEY }}" \
            -H "x-crawl-secret: ${{ secrets.CRAWL_SECRET }}" \
            -H "Content-Type: application/json")
          HTTP_CODE=$(echo "$RESPONSE" | tail -1)
          BODY=$(echo "$RESPONSE" | head -n -1)
          echo "Status: $HTTP_CODE"
          echo "Response: $BODY"
          if [ "$HTTP_CODE" -ne 200 ]; then
            echo "::error::Crawl failed with status $HTTP_CODE"
            exit 1
          fi
```

### Step 2: Create all 6 workflow files
Apply template with correct function name and cron schedule per crawler. ✓ DONE

### Step 3: Configure GitHub Secrets
Add to repository settings > Secrets:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `CRAWL_SECRET`

### Step 4: Test via manual dispatch
Trigger each workflow manually via GitHub Actions UI or:
```bash
gh workflow run crawl-gold-vn.yml
```

## Todo List
- [x] Create crawl-gold-vn.yml workflow
- [x] Create crawl-silver-vn.yml workflow
- [x] Create crawl-gasoline-vn.yml workflow
- [x] Create crawl-oil-world.yml workflow
- [x] Create crawl-metals-world.yml workflow
- [x] Create crawl-gasoline-world.yml workflow
- [ ] Add GitHub Secrets (SUPABASE_URL, SUPABASE_ANON_KEY, CRAWL_SECRET) — requires GitHub repo
- [ ] Test manual dispatch for each workflow — requires GitHub repo
- [ ] Verify cron triggers work next day — requires GitHub repo

**Note**: Last 3 items blocked — origin is GitLab, requires setting up GitHub remote first.

## Success Criteria
- Manual dispatch triggers Edge Function and returns 200
- Cron jobs fire on schedule (verify in Actions tab)
- Failed crawls show as red in GitHub Actions
- New price rows appear in DB after each successful run

## Risk Assessment
| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| GitHub Actions cron not precise (up to 15 min delay) | Expected | Acceptable for price data; not trading-critical |
| Workflow disabled after 60 days inactivity (public repos) | Medium | Add a weekly keepalive commit or use workflow_dispatch periodically |
| GitHub Actions minutes quota exceeded | Low | ~6 workflows * ~6 runs/day * 1 min = 36 min/day, well within 2000/month |
