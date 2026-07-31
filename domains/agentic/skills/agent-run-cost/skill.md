---
name: agent-run-cost
maturity: experimental
description: >-
  Estimate what an agentic workflow costs to run before it merges — fan-out × trigger
  frequency × no kill-switch — and say so in figures rather than adjectives. Agent token
  spend is invisible in a diff: a workflow that spawns one agent and one that spawns forty
  are the same few lines, and the difference only appears on a bill nobody reads during
  review. Produces a per-run and per-month estimate with its arithmetic shown, flags the
  three amplifiers, and proposes the cheapest mitigation that preserves the intent. Use
  when a PR adds or widens an agentic workflow, an AEP task class, a verification recipe,
  or a schedule that runs agents unattended.
---

# Agent run cost

Scripted automation announces its cost in wall-clock time; agentic automation does not.
A fan-out of forty subagents and a single call are the same shape in a diff, and the
difference surfaces later, on a bill, attributed to nothing in particular.

This is the token-spend counterpart to a span-volume quota guard. Same
posture: operate on **code and PRs**, before the spend exists, and produce figures.

## When to use

- A PR adds or widens an agentic workflow, AEP task class, or verification recipe.
- A workflow gains fan-out — an agent per file, per finding, per test, per PR.
- Something agentic moves from opt-in to automatic (a CI trigger, a cron, a git hook).
- An ADR or design proposes agents for work a script already does — the estimate is the
  argument, and its absence is usually the tell.

## Do not use when

- The workflow is developer-invoked, one agent, no loop — the ceiling is a person's patience.
- The change only narrows fan-out or adds a gate.

## The amplifier triad

Cost is not the per-agent price. It is the product of three things, any one of which can be
the whole problem:

| Amplifier | What it looks like | Effect |
|---|---|---|
| **Fan-out** | an agent per item — per file, per finding, per dimension, per round; nested `parallel` inside `pipeline`; a loop-until-dry with no ceiling | N× per run, and N is often data-dependent rather than fixed |
| **Trigger frequency** | runs on every push rather than on demand; a cron; a label that re-fires on each commit; a retry that respawns the fleet | turns a one-off into a rate |
| **No kill-switch** | no env var, feature flag, or budget cap; nothing to stop it mid-run; no way to disable without a revert | a runaway costs whatever it costs until someone merges a fix |

One alone is usually fine. **Fan-out × frequency with no kill-switch is the shape that
produces a surprise**, and it is worth naming explicitly in review when all three are present.

## Producing the estimate

Show the arithmetic. An estimate whose derivation is hidden is an adjective.

1. **Count agents per run.** Read the fan-out literally — how many items feed the widest
   stage, and whether that number is bounded by the code or by the data. A `pipeline` over
   changed files is unbounded by the code; `Array.from({length: 3})` is not.
2. **Estimate tokens per agent.** Prompt + the context it will read + its output. The context
   dominates: an agent that reads three files is not an agent that greps a repo.
3. **Multiply, then apply frequency.** Per-run cost × runs per week. State the assumption
   about run count — it is the number most likely to be wrong, and naming it lets a reviewer
   correct it.
4. **State the worst case separately from the expected case.** The expected case is what it
   costs on a normal PR; the worst case is what it costs on the PR that touches 400 files.
   Budget conversations are about the second one.
5. **Compare against the alternative.** If a deterministic script covers the same ground, the
   estimate belongs next to that script's cost. An agentic approach can still win — for
   adversarial review, exploration, fuzzing, or anything with no fixed oracle — but the case
   is made by the comparison, not by the capability.

Report the figures, the assumptions behind them, and the mitigation. **Do not render a
ship/no-ship verdict** — whether a cost is worth paying is a budget decision, and it belongs
to whoever owns the budget.

## Mitigation ladder

Cheapest first; stop at the rung that fits.

1. **Cap the fan-out.** A literal ceiling on items, with a `log()` of what was dropped —
   silent truncation reads as full coverage and is worse than the cost.
2. **Narrow the trigger.** On-demand or label-gated instead of every push; on the changed
   subset instead of the tree.
3. **Right-size the model per stage.** Mechanical stages rarely need the top tier; reserve it
   for the judgement stages.
4. **Add a budget guard.** A token ceiling the workflow checks between stages, so it degrades
   instead of running to completion at any price.
5. **Add a kill-switch.** An env var or flag that disables it without a revert. Cheap to add
   up front and unavailable exactly when it is needed most.

## Common pitfalls

| Mistake | Correct approach |
|---|---|
| "It's just a few agents" | Count them. Data-dependent fan-out has no "just" |
| Estimating output tokens only | Context dominates — an agent that reads the repo costs more than one that answers at length |
| Quoting an average with no worst case | The worst case is the budget conversation |
| Treating a retry as free | A retried fleet is a second fleet |
| Assuming a concurrency cap bounds cost | It bounds *parallelism*, not total spend — queued agents still run |
| Adding a kill-switch after launch | It is needed during the incident it would have prevented |
| Comparing capability instead of cost | "Agents can do this" is not "agents should do this at this price" |

## Related

- `evidence` — weighs AEP run cost when choosing an evidence lane, and tears the stack
  down after; this skill is the review-side version for workflows others will run.
- [`MetaMask/decisions#173`](https://github.com/MetaMask/decisions/pull/173) — ADR-0058
  review, where the missing token-cost estimate was raised as an open question.
