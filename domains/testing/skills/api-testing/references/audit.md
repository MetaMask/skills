# API coverage audit

Read `knowledge/api-testing-layers.md` first. This file is the procedure.

## Inventory

1. List HTTP routes (controller decorators or the router table): method, path,
   auth, and the function they call.
2. List unit files and every integration project. Note which project boots
   the app and which project calls functions against a database.
3. For each route or reader, mark the strongest layer that **executes** the
   behavior:
   - unit, dependencies mocked
   - function + real database
   - HTTP + real database
   - none

A file that exists is not coverage. Open it and see what it asserts.

## Report

Use this table. One row per distinct behavior, not per file.

| Behavior | Responsible boundary | Covered by | Proposed layer | Why not the layer above |
| --- | --- | --- | --- | --- |
| … | SQL join / HTTP status / pure function / deployed process | none, or the weaker test | unit / function integration / HTTP integration / e2e / accept | … |

Then stop, unless the user already asked to add the tests.

Call out accepted gaps in the same table with proposed layer `accept` and the
harness limit (no fixture, dead upstream, route does not expose the behavior).

## Implement

Only after the user asks.

1. Prefer extending the suite that already owns the layer. A new file is for
   a route that has no file yet.
2. Reuse seeders. A second insert of the same actor, chain, and contract
   usually violates the position key — add another trade on the existing row.
3. Positive and negative cases are different tests when both can regress
   independently. "Absent from the other list" is not "present on this list".
4. For a join that normalizes identifiers, seed the stored spelling and call
   with the caller's spelling (mixed-case, prefixed, or bare).
5. For an upsert, assert the second write (replaced reason, revived row), not
   only the first insert. That is what hits `ON CONFLICT`.
6. Run the owning test files. Fix the test when the assertion guessed the
   response field. Change production code only when the run shows a real bug.

## Placements that keep coming up

**Query bug found while writing a unit spec.** The unit test checks parameters.
Add a function-level integration test that seeds both tables and asserts the
row comes back. Skip HTTP if the handler forwards the input. Skip e2e.

**Filter that exists only in SQL** (`isInFeed`, a comment flag, open vs
closed). If the route is the only caller, an HTTP test is enough: it runs the
SQL and checks the body. Still seed the row the filter must keep and the row
it must drop.

**Bucket or group expansion.** Two writes that should become one response
item, and a sibling that must stay separate. Seed them on one parent row when
the schema has a uniqueness key. A cross-system group is an HTTP or function
test that requests one member and expects the other member's row.

**User-scoped write with a partial unique index.** Mocked unit tests do not
see the index. Hit the route: unauthorized, create, replace, list, delete,
invalid combination, and the not-found target.

**Behavior the public route does not call.** Do not add an HTTP test for it.
If nothing else calls it either, say so. Do not invent a scope query param
the API does not have.
