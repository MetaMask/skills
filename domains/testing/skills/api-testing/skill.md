---
name: api-testing
description: >
  Audits an HTTP API and adds missing tests at the lowest layer that
  exercises the responsible boundary. Use when asked to audit API coverage,
  find untested routes, add unit or integration tests, or choose between
  unit, in-process database integration, HTTP integration, and e2e for a
  service.
maturity: experimental
---

# API testing

One skill for HTTP service APIs. Classify the gap, pick the layer, then open
only the matching reference.

**Not this skill:** MetaMask Mobile (`mobile-testing`) and MetaMask Extension
(`extension-testing`). Those products have their own layers.

## When To Use

- Auditing which routes or readers have no test that actually runs the behavior
- Deciding unit vs integration vs e2e before writing a test
- Adding the missing tests after that audit

**Out of scope:** performance, visual, flakiness, and client UI tests.

## Install

Experimental, so it is not in the default stable set:

```bash
metamask-skills sync --include testing/api-testing --save
```

## Workflow

### 1. Choose the layer

Read installed `knowledge/api-testing-layers.md` (source:
[`../../knowledge/api-testing-layers.md`](../../knowledge/api-testing-layers.md))
before writing any test. `references/layers.md` is only a redirect stub.

### 2. Audit before writing

Follow [`references/audit.md`](references/audit.md). Default mode is
**analyze**: report the gaps and the layer for each one, then stop.

Implement only when the user asks to add the gaps, or when the request
already says to create the missing tests.

### 3. Implement in the existing harness

- Match the suite that already owns that layer: file names, seeders, auth
  stubs, and database reset.
- One behavior per test.
- Assert the field the route actually returns. Read the exception filter
  before asserting `error` or `errorMessage`.
- Run the suite that owns the layer. Do not claim a full CI run if only one
  project ran.

## Hard rules

1. **Layer gate first.** Prefer unit → function-level integration → HTTP
   integration → e2e. Name why each cheaper layer fails before proposing the
   next one.
2. SQL text in a unit test is not a join. A mocked repository is not a
   constraint.
3. Do not add an HTTP test for an assertion a function-level test already
   runs, when the handler only forwards the input.
4. HTTP integration owns auth, validation, status codes, the response body,
   and writes whose conflict target is a real index.
5. A negative case does not prove the positive case.
6. Case-folding and one-sided prefixes are database behavior. Test both
   spellings there.
7. Do not invent a second harness, and do not point a test at a live
   upstream the suite does not fixture. Record that as an accepted gap.

## Examples

```
User: Audit this API and show what the tests miss
Agent: knowledge/api-testing-layers.md → references/audit.md (analyze only)
```

```
User: The token feed is empty for a mixed-case address
Agent: unit asserts SQL params only → function-level integration runs the join.
       No HTTP test: the route forwards the path parameter.
       No e2e.
```

```
User: Add the missing API integration gaps
Agent: audit.md implement section → extend the existing HTTP suite only for
       route behavior (filters, positive cases, ON CONFLICT). Leave For You
       and dead upstreams as accepted gaps.
```
