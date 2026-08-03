# Lane → declarative assertion mapping (ADR-0058 bridge)

Maps each evidence-catalog lane to a declarative assertion form, so a Claim Card can be expressed as an ADR-0058 recipe (pre-conditions → proof targets → assertions → screenshot points) where possible — and so we know which lanes are **CDP-expressible** vs **out-of-band**. State/log assertions give determinism; screenshots/video give reviewer confidence. See [[../ITERATION]] items 9–11 and MetaMask/decisions#173.

| Lane | Assertion form | Expressible as a CDP recipe action? |
|---|---|---|
| A1 / B1 visual | screenshot at a proof point + (optional) DOM/a11y assertion | **yes** — Chrome CDP |
| B2 e2e | the spec's own assertions; trace.zip as artifact | yes — it *is* a driver |
| B3 falsifying test | test exit code: fail@`main`, pass@branch | out-of-band (test runner) |
| C1 startup traces | `stateHooks.getCustomTraces()[name] < threshold` | **yes** — `Runtime.evaluate` |
| C2 web-vitals | `stateHooks.getWebVitalsMetrics().inp < 200` | **yes** |
| C3 long-task / TBT | `stateHooks.getLongTaskMetricsWithTBT().tbt < 200` | **yes** |
| C4 render (WDYR) | console-log assertion: 0 unnecessary re-renders | partial — needs console capture |
| C5 benchmark | metric delta vs paired baseline > threshold | out-of-band (benchmark runner) |
| C6 DevTools/CDP | netlog: request absent/present; profile metric | **yes** |
| D1 / D2 bundle/chunk | static: chunk-manifest membership / size delta | out-of-band (build artifact) |
| D3 LavaMoat | static: `policy.json` diff empty / justified | out-of-band (git diff) |
| D4 manifest | static: permissions diff empty | out-of-band |
| E1 / E2 Sentry/Tempo | external query link (before/after window) | out-of-band (dashboard) |
| F1 migration | `changedKeys == expected` + state shape valid | out-of-band (migration test) |
| F3 simulation | `simulationData.{gasUsed,stateDiff}` matches | **yes** — `Runtime.evaluate` on state |
| F5 flag matrix | the same assertion repeated per `remoteFeatureFlags` state | **yes** |
| F7 i18n | static: `verify-locales` exit 0 | out-of-band |
| F8 runtime containment | `Object.isFrozen(Object.prototype)`; scuttled global throws + exception resolves; `typeof SNOW` | **yes** — `Runtime.evaluate`, but only against the SHIPPED build variant (dev is unscuttled, test's exception list is wider) |

**Takeaway.** UI-state and runtime-metric lanes (A/B-visual, C1–C3/C6, F3/F5) map cleanly to CDP recipe assertions — ADR-0058's sweet spot. Static (D, F7), test-runner (B3, C5, F1), and dashboard (E) lanes are **out-of-band**: the recipe should *reference* them as proof targets without executing them. That out-of-band reference is precisely the **non-UI scaling gap** MajorLift's review of #173 flagged — a recipe schema that admits out-of-band assertion references (not only CDP actions) closes it. This table is the proposed taxonomy to contribute back (ITERATION item 10).
