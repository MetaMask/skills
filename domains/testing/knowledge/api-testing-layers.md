---
name: api-testing-layers
domain: testing
description: >
  HTTP API test-layer policy. Prefer unit, then function-level integration
  against real I/O, then HTTP integration, and e2e only for a deployed
  process. Canonical source for api-testing.
---

# API Testing Layers

**Scope: HTTP service APIs.** For MetaMask Mobile use `knowledge/testing-layers.md`
and `mobile-testing`. For MetaMask Extension use
`knowledge/extension-testing-layers.md` and `extension-testing`.

**This file is the single source of truth** for API test-layer placement.
Do not duplicate this policy in skill `references/` — open this file (installed
as `knowledge/api-testing-layers.md` beside testing skills).

**Entrypoint:** Install **`api-testing`**. It is experimental: opt in with
`--include testing/api-testing`.

## Policy

Choose the **lowest-cost deterministic layer** that exercises the boundary
responsible for the behavior. Prefer **unit → function-level integration →
HTTP integration → e2e**.

Do **not** propose e2e until the lower layers have been ruled out in writing.
"The route is important" and "it feels end to end" are not reasons.

## Decision tree

```
Is this a distinct realistic regression?
├─ No → do not add a test
└─ Yes → Already covered at a layer that executes the responsible boundary?
   ├─ Yes → stop
   └─ No → Pure logic, or fully visible with mocked dependencies?
      ├─ Yes → unit
      └─ No → Fails only when real SQL, a constraint, or a writer runs,
         and the route adds no behavior of its own?
         ├─ Yes → function-level integration (call the function; real database)
         └─ No → Route adds auth, validation, status mapping, response shape,
            or a conflict the mock hides?
            ├─ Yes → HTTP integration (booted app, project HTTP client)
            └─ Requires a deployed process or a live upstream the harness
               cannot stand up?
               ├─ Yes → e2e. Write why each lower layer fails and which
               │        process boundary is required.
               └─ No → accept the gap. Do not invent e2e.
```

## Defaults

| Layer | Owns | Typical home |
| --- | --- | --- |
| **Unit** | Pure helpers, schema and DTO rules, error types, service branches whose dependencies are mocked | Colocated `*.spec.ts` / `*.test.ts` |
| **Function-level integration** | Queries, joins, constraints, and writers. The function runs; the database is real. The HTTP server stays down | The suite that imports source and talks to a test database |
| **HTTP integration** | Status codes, auth, validation, response body, and writes whose conflict target only exists in the migrated schema | The suite that boots the app in-process and calls routes |
| **E2e** | A process the test runner did not start: a deploy, real OIDC, or an upstream with no fixture | A separate suite against that process |

## What does not count as coverage

- A unit test that asserts SQL text or parameter arrays. It does not execute the join.
- A unit test whose repository is mocked. It does not exercise `ON CONFLICT`, partial unique indexes, or foreign keys.
- A negative HTTP assertion (an open row is absent from the closed list). It does not prove a closed row comes back.
- An HTTP test that repeats a function-level assertion when the handler only forwards the parameter.
- An e2e test that hits the same route and database the HTTP integration suite already boots.

## Address and identifier joins

When two tables store the same identifier differently, test both spellings against the real database:

- Case-insensitive identifiers (EVM addresses) are folded the same way on every side of the join. A mixed-case input must still return the row.
- Case-sensitive identifiers (base58 mints, currency codes) must not be folded. A lowercased input must miss.
- A prefix that exists on only one side of the join is stripped or added in one place. Assert both the stored form and the form the caller sends.

## Accepted gaps

Record a gap instead of writing a test when the harness cannot serve it. The usual case is an enriched route whose upstream is staged at a dead port and has no fixture. Say that in the audit. Do not point the test at a live service.
