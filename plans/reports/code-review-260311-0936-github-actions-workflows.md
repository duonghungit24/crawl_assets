# Code Review: GitHub Actions Workflows (Phase 05)

**Reviewer**: code-reviewer | **Date**: 2026-03-11
**Scope**: 6 workflow files in `.github/workflows/`

## Files Reviewed
- `.github/workflows/crawl-gold-vn.yml` (28 lines)
- `.github/workflows/crawl-silver-vn.yml` (28 lines)
- `.github/workflows/crawl-gasoline-vn.yml` (28 lines)
- `.github/workflows/crawl-oil-world.yml` (28 lines)
- `.github/workflows/crawl-metals-world.yml` (28 lines)
- `.github/workflows/crawl-gasoline-world.yml` (28 lines)
- Cross-referenced: `supabase/functions/_shared/crawl-auth.ts`, `html-parser.ts`, `crawl-gold-vn/index.ts`

## Overall Assessment

Solid, clean implementation. All 6 workflows follow an identical template pattern (DRY via convention). YAML syntax is correct, secrets are properly referenced, cron schedules map correctly to intended timezones. The curl error handling is above average for this pattern. A few medium/low priority improvements below.

---

## Critical Issues

None.

---

## High Priority

### H1. Missing `timeout-minutes` on job

**Problem**: Default GitHub Actions job timeout is 360 minutes (6 hours). If Supabase or the upstream price source hangs, the workflow runner will burn minutes for hours. The plan doc states "workflow should complete in < 1 minute."

**Impact**: Wasted GitHub Actions minutes quota; delayed failure notification.

**Fix**: Add `timeout-minutes: 5` to each job:
```yaml
jobs:
  crawl:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      ...
```

### H2. Missing `concurrency` guard

**Problem**: If GitHub Actions cron fires late and overlaps, or manual dispatch is clicked twice, two instances of the same crawler run simultaneously. This could insert duplicate data (mitigated by `onConflict` upsert) but wastes runner minutes and could cause upstream rate limiting.

**Impact**: Redundant API calls, potential rate-limit bans from webgia.com.

**Fix**: Add concurrency group at job or workflow level:
```yaml
concurrency:
  group: ${{ github.workflow }}
  cancel-in-progress: true
```

### H3. No `--fail` or `--max-time` on curl

**Problem**: `curl -s` silently succeeds on network errors (DNS failure, connection refused). The `-w "\n%{http_code}"` technique only captures HTTP status when curl actually gets a response. If curl cannot connect at all, `$HTTP_CODE` will be empty and the `-ne 200` check triggers, but the error message will be confusing (just "Status:" with no code).

Additionally, if the Edge Function hangs, curl will wait indefinitely (no timeout).

**Impact**: Confusing failure logs; potential indefinite hangs.

**Fix**: Add `--max-time 60 --connect-timeout 10` and handle empty HTTP_CODE:
```bash
RESPONSE=$(curl -s -w "\n%{http_code}" --max-time 60 --connect-timeout 10 \
  -X POST "${{ secrets.SUPABASE_URL }}/functions/v1/crawl-gold-vn" \
  ...
```

---

## Medium Priority

### M1. Missing `permissions` block (least privilege)

**Problem**: Without explicit permissions, workflows inherit the default token permissions (which may include write access to repo contents, packages, etc.). These workflows need zero permissions.

**Impact**: Broader attack surface if secrets are compromised; violates principle of least privilege.

**Fix**: Add empty permissions block:
```yaml
permissions: {}
```

### M2. VN crawlers run on weekends unnecessarily

**Problem**: `crawl-gold-vn.yml` runs at `0 2,5,8,11 * * *` (every day including weekends). Vietnamese gold shops are closed on Sundays, and Saturday hours are limited. Similarly for silver and gasoline VN.

**Impact**: Wasted Actions minutes (~30% of VN crawler runs hit weekends with no new data). The Edge Functions handle this gracefully (they just upsert the same stale data), so this is low-risk but wasteful.

**Fix** (optional): Restrict to weekdays + Saturday:
```yaml
cron: "0 2,5,8,11 * * 1-6"  # Mon-Sat only
```
Or keep as-is if weekend prices sometimes update -- pragmatic choice.

### M3. No retry mechanism on workflow failure

**Problem**: If a crawl fails (upstream site temporarily down), there is no automatic retry. The next scheduled run may be hours away.

**Impact**: Missing price data points during transient outages.

**Fix** (optional): GitHub Actions does not support native step retry, but you can use the `nick-fields/retry` action or a simple bash loop. Alternatively, accept this since the Edge Functions themselves have `fetchWithRetry` (1 retry with 2s delay).

### M4. Response body may leak to logs

**Problem**: `echo "Response: $BODY"` prints the full Edge Function response to GitHub Actions logs. If the response ever contains sensitive data (DB errors with table names, internal IPs), it would be visible in workflow logs.

**Impact**: Low risk currently (responses are controlled JSON), but defense-in-depth concern.

**Fix**: Consider masking or truncating:
```bash
echo "Response: ${BODY:0:500}"
```

---

## Low Priority

### L1. No `workflow_dispatch` inputs for debugging

**Problem**: `workflow_dispatch` is enabled (good for testing), but no inputs are defined. Adding an optional `dry_run` input could help debugging without writing to DB.

**Fix** (nice-to-have):
```yaml
workflow_dispatch:
  inputs:
    dry_run:
      description: 'Run without writing to DB'
      type: boolean
      default: false
```
This would require Edge Function support for dry_run mode.

### L2. All 6 files are identical except name and cron

**Problem**: Copy-paste pattern across 6 files. If the curl template needs updating (e.g., adding `--max-time`), all 6 files must be edited.

**Impact**: Maintenance burden. Acceptable at 6 files; would be problematic at 20+.

**Fix**: Could use a reusable workflow (`workflow_call`) or composite action, but YAGNI at current scale. Just note for future.

### L3. Pin `ubuntu-latest` to specific version

**Problem**: `ubuntu-latest` will eventually shift to a new major version, potentially breaking curl behavior or shell semantics.

**Impact**: Very low risk for these simple workflows.

**Fix** (optional): Use `ubuntu-24.04` for determinism.

---

## Edge Cases Found by Scout

1. **Auth header conflict**: Workflows send both `Authorization: Bearer $SUPABASE_ANON_KEY` and `x-crawl-secret: $CRAWL_SECRET`. The `crawl-auth.ts` checks `x-crawl-secret` first (correct), but falls back to `authorization` header stripping "Bearer ". This means if `x-crawl-secret` header is somehow missing, it would compare the anon key against CRAWL_SECRET, which would fail auth. This is actually safe behavior (fail-closed), but the fallback path is confusing. The `Authorization` header exists for Supabase's own JWT gateway, not for crawl auth. **No action needed**, but worth documenting.

2. **GitHub Actions 60-day inactivity disabling**: For public repos, GitHub disables scheduled workflows after 60 days of no repo activity. The plan doc already notes this risk. Consider a monthly keepalive or rely on `workflow_dispatch` usage.

3. **Cron timing precision**: GitHub Actions cron can delay up to 15-20 minutes under load. For price data this is acceptable (plan doc acknowledges this).

---

## Positive Observations

- Clean, consistent template across all 6 files
- Proper use of GitHub Secrets for all sensitive values (no hardcoded URLs, keys, or tokens)
- Good error handling pattern: captures HTTP status code, logs body, uses `::error::` annotation, exits non-zero
- `workflow_dispatch` included on all workflows for manual testing
- Cron schedules are well-designed: VN crawlers during ICT business hours, world crawlers after US market close, metals on 24h cycle
- Comments in YAML document the intended ICT/UTC mapping

---

## Recommended Actions (Prioritized)

1. **Add `timeout-minutes: 5`** to all 6 workflows [H1]
2. **Add `concurrency` group** to prevent overlapping runs [H2]
3. **Add `--max-time 60 --connect-timeout 10`** to curl [H3]
4. **Add `permissions: {}`** for least privilege [M1]
5. (Optional) Restrict VN cron to Mon-Sat [M2]
6. (Optional) Truncate response body in logs [M4]

---

## Metrics

| Metric | Value |
|--------|-------|
| Files reviewed | 6 |
| Total LOC | 168 |
| Critical issues | 0 |
| High priority | 3 |
| Medium priority | 4 |
| Low priority | 3 |
| Security issues | 0 (secrets properly used) |
| YAML syntax errors | 0 |
| Cron schedule errors | 0 |

---

## Unresolved Questions

1. Are the 3 GitHub Secrets (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `CRAWL_SECRET`) already configured in the repository? Phase 05 TODO lists this but status is unclear.
2. Should VN crawlers skip weekends/Sundays to save Actions minutes, or is weekend data collection desired?
3. Is there a monitoring/alerting plan for persistent crawl failures beyond GitHub Actions email notifications?
