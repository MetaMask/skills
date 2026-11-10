---
name: agentic-design-system-strategy
domain: ui
description: MetaMask Agentic Design System strategy — goal, lifecycle, and delivery model
---

# MetaMask Agentic Design System Strategy

Canonical strategy sources:

- [Strategy Google Doc](https://docs.google.com/document/d/1wwvEJxom097q-ehSJAfqKvWb01ZW-kmlpy7BQW5In40/edit) — maintained strategy document
- [MMDS Agentic Strategy FigJam](https://www.figma.com/board/3ijfD8P0KHe1M5ubwhk27k/MMDS-Agentic-Strategy) — lifecycle diagrams and tooling map

Tracking:

- [DSYS-1078 — MetaMask Agentic Design System Epic](https://consensyssoftware.atlassian.net/browse/DSYS-1078)
- [MetaMask/skills#138](https://github.com/MetaMask/skills/pull/138) — Extension `ui-development` gateway
- [MetaMask/metamask-design-system#1465](https://github.com/MetaMask/metamask-design-system/pull/1465) — Storybook MCP and MMDS broker work

## Goal

Any agent building MetaMask UI should use the MetaMask Design System (MMDS) by default. Agents should be able to check their work against tokens, components, and patterns. Design system designers and engineers should only review work that requires human judgment.

This applies wherever UI is built and reviewed: Cursor and other coding agents, Figma, Replit prototypes, and CI.

## Core model

One knowledge layer, three deliveries. MMDS holds tokens, components, and patterns. Tools are delivery mechanisms only — do not maintain separate copies of MMDS guidance inside each tool.

| Moment | What happens |
| :---- | :---- |
| **Create** | Agents read current MMDS guidance before building — through skills, Storybook MCP, Figma MCP, and Code Connect. |
| **Review** | Deterministic checks (ESLint, fitness functions) plus agentic review for judgment calls. |
| **Audit** | Recurring queries across existing screens to find drift, custom UI, and documentation gaps. |

## Producer / consumer split

- **Consumer skills** (`ui-development` repo overlays) route agents to current MMDS guidance for product UI create and review workflows.
- **Provider skills** (future `design-system` domain) support MMDS authoring, release, and documentation maintenance.
- **Storybook MCP** (`storybook-broker-mcp`) is the preferred delivery mechanism for current MMDS knowledge in coding agents. Package exports and consumer Tailwind configuration are the ordered fallback when the broker is unavailable.

## Foundation workstreams

1. **Thin consumer gateway skills** — Refine `ui-development` overlays into stable routers (Create + Review) instead of static component inventories.
2. **Storybook MCP integration** — Treat Context Forge's preconfigured `storybook-broker-mcp` as the primary source; document explicit fallback behavior without embedding setup instructions in skills.
3. **MMDS source and broker readiness** — Keep Storybook documentation, exports, and broker surfaces current for agent consumption.
4. **Automated alignment checks** — Extend CI and review workflows to validate tokens, components, and patterns where feasible.
5. **Provider-side skills** — Add a `design-system` domain and `metamask-design-system` maintainer overlay in the skills repo.

## Horizon

| Horizon | Focus |
| :---- | :---- |
| **Now** | Build the shared knowledge path and establish quality baselines — point MetaMask Skills to Storybook MCP, begin Figma/React/React Native alignment, expand Code Connect, audit MMDS and product usage. |
| **Next** | Operationalize Create, Review, and Audit in normal delivery — enable the gateway by default in Extension and Mobile, run MMDS-focused review, load relevant skills per UI PR, run recurring audits. |
| **Later** | Build a trusted feedback and remediation loop — agents create issues or PRs for alignment gaps, automate low-risk fixes, retain human approval for judgment calls. |

## Principles for skills

- MMDS is the default; intentional documented custom UI is allowed.
- Skills are gateways and durable constraints, not second copies of MMDS documentation.
- Do not maintain static component inventories, deprecated-name lists, or MCP setup instructions in consumer skills.
- Query current Storybook guidance before choosing components, APIs, tokens, or patterns.
- When Storybook MCP is unavailable, follow the ordered fallback defined in the relevant repo overlay.
