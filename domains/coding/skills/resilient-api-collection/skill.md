---
name: resilient-api-collection
description: Build resilient data collection scripts that paginate APIs, handle rate limits, and retry transient errors. Use when writing scrapers, API collectors, data pipelines, or any script that fetches paginated data from external APIs (GitHub GraphQL, REST APIs, etc.).
---

# Resilient API Collection Scripts

## Core Architecture

Every collection script needs these layers:

```
run_query()        → single request with retry + error classification
fetch_all_pages()  → pagination loop with adaptive page sizing
main()             → orchestration, dedup, persistence
```

## 1. Error Classification

Classify errors **before** choosing a recovery strategy. Different errors need different fixes.

| Error Type | Signal | Recovery |
|---|---|---|
| **Resource/complexity limit** | Query too expensive for server | Reduce page size |
| **Rate limit** (primary) | 429, `X-RateLimit-Remaining: 0` | Wait until reset time |
| **Rate limit** (secondary) | 403 + "secondary rate limit" | Exponential backoff (start 60s) |
| **Transient server error** | 502, 503, 504, stream reset | Retry with exponential backoff |
| **Client error** | 400, 401, 404 | Don't retry — fix the request |

### CLI tools hide error details

Tools like `gh`, `curl`, `httpie` surface errors differently than raw HTTP responses:

- **`gh api graphql`**: "Resource limits exceeded" appears in `stderr` with non-zero exit code, NOT in the JSON response `errors` array. Always check `stderr` first, before checking `returncode`.
- Rate limit info may be in response headers (not visible via CLI) or in error messages.

```python
# Check stderr BEFORE returncode — some errors are in stderr even on exit 0
stderr = result.stderr.strip()

if "Resource limits" in stderr or "resource limit" in stderr.lower():
    return RESOURCE_LIMIT_SIGNAL  # caller reduces page size

if result.returncode == 0:
    data = json.loads(result.stdout)
    # Also check JSON errors (some APIs put limits here)
    if "errors" in data:
        msg = data["errors"][0].get("message", "")
        if "Resource limits" in msg or "timeout" in msg.lower():
            return RESOURCE_LIMIT_SIGNAL
    return data

# Classify non-zero exit
is_transient = any(s in stderr for s in [
    "502", "503", "504", "429", "rate limit",
    "secondary", "stream error", "CANCEL"
])
```

## 2. Retry with Exponential Backoff

```python
MAX_RETRIES = 5
INITIAL_BACKOFF = 5  # seconds

for attempt in range(1, MAX_RETRIES + 1):
    result = execute_request(...)

    if success:
        return result
    if is_resource_limit(error):
        return RESOURCE_LIMIT_SIGNAL  # don't retry, reduce page size
    if not is_transient(error):
        return None  # permanent failure
    if attempt == MAX_RETRIES:
        return None  # exhausted

    wait = INITIAL_BACKOFF * (2 ** (attempt - 1))
    log(f"Transient error (attempt {attempt}/{MAX_RETRIES}), retrying in {wait}s")
    time.sleep(wait)
```

Key: resource-limit errors should NOT be retried — the same query will fail identically. Signal the caller to reduce page size instead.

## 3. Adaptive Page Sizing

Start conservatively. Halve on resource-limit errors. Set a floor.

```python
MIN_PAGE_SIZE = 5
MAX_REDUCTIONS = 4
page_size = 50  # not 100 — nested sub-selections multiply complexity

while has_more_pages:
    data = run_query(..., page_size=page_size)

    if data == RESOURCE_LIMIT_SIGNAL:
        reductions += 1
        if reductions > MAX_REDUCTIONS or page_size <= MIN_PAGE_SIZE:
            break  # can't go smaller
        page_size = max(MIN_PAGE_SIZE, page_size // 2)
        time.sleep(10)  # cool down before retry
        continue  # retry same page with smaller size

    # process nodes, advance cursor...
    time.sleep(2)  # inter-page delay to avoid secondary rate limits
```

### Why 50, not 100?

GraphQL query cost = `nodes × sub-selections`. A query fetching 100 PRs with `reviews(first:50)`, `participants(first:30)`, `commits(first:1)` easily exceeds GitHub's 500K node limit. Starting at 50 avoids most resource-limit errors.

## 4. Deduplication and Incremental Collection

Always dedup by natural key before writing. This lets re-runs extend existing data.

```python
def dedup(existing, new, key_fn):
    by_key = {}
    for item in existing:
        by_key[key_fn(item)] = item
    for item in new:
        by_key[key_fn(item)] = item  # new overwrites old
    return list(by_key.values())

# On write:
existing = load_json(path) if os.path.exists(path) else []
final = dedup(existing, new_items, key_fn=lambda x: (x["repo"], x["number"]))
save_json(path, final)
```

## 5. Observability

### Force unbuffered output

Python buffers stdout when output is captured (subprocess, pipe, file redirect). Progress lines never appear.

```python
import sys
sys.stdout.reconfigure(line_buffering=True)
# OR run with: python3 -u script.py
```

### Log structure for monitoring

```
=== repo-name (query-type) ===
  Page 1: 50 nodes, hasNext=True (size=50)
  Page 2: 50 nodes, hasNext=True (size=50)
  Resource limit exceeded (page_size=50), signaling page-size reduction
  Reducing page size to 25 and retrying page 3 (reduction 1/4)
  Page 3: 25 nodes, hasNext=True (size=25)
  ...
  Total: 430 items, collected 430, 3169 sub-items
```

Every log line should include: page number, items returned, whether there are more pages, and current page size.

## 6. Inter-Page Delays

GitHub's secondary rate limit triggers on sustained request volume, not individual request cost. Add 2-3s between pages.

```python
PAGE_DELAY = 2  # seconds

# After each successful page:
time.sleep(PAGE_DELAY)

# After a resource-limit reduction:
time.sleep(INITIAL_BACKOFF * 2)  # longer cooldown
```

## Checklist

When writing a collection script, verify:

- [ ] Error classification distinguishes resource-limit from rate-limit from transient
- [ ] Resource-limit errors reduce page size (not retry same query)
- [ ] Transient errors retry with exponential backoff
- [ ] Non-retryable errors fail fast
- [ ] Page size starts at 50 or lower for nested queries
- [ ] Page size has a floor (5-10) and max-reduction cap
- [ ] Inter-page delay prevents secondary rate limits
- [ ] Output is unbuffered (`-u` flag or `reconfigure`)
- [ ] Each log line includes page number, count, hasNext, page size
- [ ] Data is deduped by natural key before writing
- [ ] Re-runs merge with existing data (incremental collection)
- [ ] Collection log records run metadata (timestamps, repos, filters)
