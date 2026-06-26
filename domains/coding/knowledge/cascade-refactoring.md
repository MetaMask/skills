---
name: cascade-refactoring
domain: coding
description: Only modify files that would fail to compile without the change. Verify with a blast-radius check before committing.
---

# Cascade Refactoring Anti-Pattern

When making a targeted change in one layer of a system, do not follow type/lint feedback across the dependency graph into "while I'm here" cleanups.

## Rule

Only modify files that would **fail to compile** without the change. If a consumer still compiles with the old types, leave it alone.

## Pattern

A change to one layer triggers type errors in adjacent layers. The correct response is to fix only what breaks. The wrong response is to follow each error transitively and refactor downstream consumers.

Those downstream changes compile, but they're cosmetic refactoring disguised as necessary fixes — expanding scope without expanding value.

## Blast-Radius Check

Before committing, list every modified file and justify it against the task description:

- Does this file fail to compile without the change? → Keep
- Does it compile fine with the old types? → Revert

## Signal

If a diff touches files from multiple unrelated layers for a task scoped to one layer, something leaked. Common pattern: a "collection" file change pulling in "reporting" or "display" file changes.
