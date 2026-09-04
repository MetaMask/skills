# Running AEP locally

Everything the local Autonomous Engineering Platform run needs: bring-up, submit, poll,
fetch artifacts, tear down. The hosted instance (`aep.dev.web3factory.consensys.net`) has
not resolved since 2026-06, so local is the only path.

The skill body links here rather than carrying this inline. An AEP run is the heaviest
lane in the catalog and most validations do not need it — a falsifying test, a single
screenshot, or an artifact CI already produced usually closes the same falsifier. Read
this when you have decided an AEP run is warranted.

Every bullet below cost a failed run at least once.

## Preflight — bring up what is down

The hosted AEP doesn't resolve (`aep.dev.web3factory.consensys.net` is dead as of 2026-06). Everything runs locally. Health-check, then bring up only what's down. 

Fast checks:

```bash
AEP=~/Code/metamask/metamask-autonomous-engineering-platform
curl -fsS localhost:3000/health >/dev/null && echo "control-plane up"   || echo "control-plane DOWN"
curl -fsS localhost:8233 >/dev/null && echo "temporal UI up"            || echo "temporal DOWN"
docker ps --format '{{.Names}}' | grep -E 'mm-aep-postgres-dev|mm-aep-temporal-dev'
```

Bring-up order (each in its own shell; details + env in the reference):
1. `yarn dev:postgres` (docker `postgres:16-alpine`, `mm-aep-postgres-dev`, port 5432)
2. `yarn dev:temporal` (temporal dev server; UI on 8233)
3. `yarn db:migrate`
4. **worker** — `yarn dev:worker` on **Node ≥ 24.13**, env `ANTHROPIC_API_KEY=host-subscription`, `CLAUDE_CODE_EXECUTABLE=~/.local/bin/claude`, `GITHUB_TOKEN="$(gh auth token)"`, `SANDBOX_PROVIDER=local` (needs JFrog `npm login` first; relies on uncommitted local patches)
5. `yarn dev:control-plane` (`localhost:3000`)

If any of the local patches (`local-sandbox-adapter.ts` timeout, `claude-agent-runner.ts` auth, the `perf-validation/` graph) are missing from the working tree, the reference says how to restore them — `git status` in the AEP repo should show them modified/untracked.
## Run mechanics — submit, poll, fetch

The control-plane is a thin REST shell. Submit a PR-validation task, poll the run, pull artifacts from the evidence bundle.

```bash
CP=localhost:3000
PR="https://github.com/MetaMask/metamask-extension/pull/<n>"

# Submit (publishEvidence:false ALWAYS for local runs — the platform otherwise
# writes to the public PR body even on failure, leaking local paths/usernames)
RUN_ID=$(curl -fsS -X POST "$CP/v1/tasks" -H 'content-type: application/json' -d '{
  "repo": "MetaMask/metamask-extension",
  "title": "Visual validation — PR #<n>",
  "taskClass": "visual_validation",
  "externalRef": "'"$PR"'",
  "payload": { "prUrl": "'"$PR"'", "description": "<targeting hint>", "publishEvidence": false }
}' | node -e 'process.stdin.on("data",d=>console.log(JSON.parse(d).runId||JSON.parse(d).id))')

# Poll
curl -fsS "$CP/v1/runs/$RUN_ID" | node -e 'const r=JSON.parse(require("fs").readFileSync(0));console.log(r.status); (r.evidenceBundle?.artifactRefs||[]).forEach(a=>console.log(a.name,a.mediaType))'

# Fetch an artifact
curl -fsS "$CP/v1/runs/$RUN_ID/artifacts/<artifactName>" -o /tmp/<artifactName>
```

- `taskClass`: `visual_validation` or `perf_validation`. The worker auto-enriches the payload from `prUrl` (pulls headSha, base, diff, files, linked issues via the GitHub app) — you only supply `prUrl` + a `description` targeting hint.
- The **targeting hint** (`payload.description`) is how you steer the agent to the surface under test. Be specific: which screen, which control, what to toggle. For hard-to-reach surfaces, name the reachable fallback (e.g. the Shield entry modal stands in for the Perps tutorial modal, which is gated in the default fixture).
- Artifact regex allows **png/jpg/log/txt only** — no video. Screen recordings need the side-channel recipe (catalog + publishing reference).

### Concurrent runs (multiple agents / parallel lanes)

Five shared resources need per-run isolation on one machine — collisions cross-contaminate evidence *silently* (wrong session's logs attributed to a run), which is an integrity failure, not flakiness: **(1)** CDP debug ports — derive per run, never hardcode; **(2)** e2e harness service ports (anvil/proxy/fixture/mocha) — one e2e run at a time per worktree, one worktree per agent (`wt new`), and never rebuild `dist/` in a worktree with an active run; **(3)** artifact dirs — per-run namespaces; `test-artifacts/` is per-worktree shared state, harvest failure artifacts before the next run overwrites the same test-title dir; **(4)** evidence-repo uploads — run-scoped paths (`pr-<n>/<run-id>/`), retry-with-fresh-sha on 409, never overwrite another run's published files; **(5)** commit-pinning — pin only after your own final upload lands, verifying your files exist at that sha. Safe to share: JFrog login, a read-only `dist/`, the AEP stack itself.

### Trust the evidence (anti-reward-hacking)

A green result is not proof. The vacuous-pass trap is the floor: if `promptCrafter` errors, the chain "passes" via skip with **zero artifacts** — a pass is only real if `evidenceBundle.artifactRefs` is non-empty with the expected media. Beyond that, every lane must clear a trustworthiness gate before you believe or publish it: **does the artifact show the *claimed* surface** (not a spinner/wrong screen), **does the test exercise the *changed* code** (fails on `main`), **does the signal exceed noise**, **could the assertion have failed**? The Claim Card's Falsifier is the anchor. Full gate + per-lane traps: **[references/evidence-trustworthiness.md](references/evidence-trustworthiness.md).**

### perf_validation caveat

The `perf-validation/` graph is **uncommitted local AEP work** (added 2026-06-11). It writes falsifiable network/static/smoke assertions and gives the tester deterministic `.aep/` helpers (CDP netlog, phase segmentation, source-map chunk membership). It requires a `yarn webpack --test` build first (the browserify `build:test` has no code splitting, so `import()` never hits the network there). Temporal caps activity results at ~2MB — artifact refs must be content-free; only `evidenceBundle` carries base64. If the graph isn't in the working tree, perf runs won't register — fall back to manual DevTools/CDP capture (catalog).
## Teardown — always, on every exit path

The stack is the heaviest thing this skill starts — postgres + temporal + a Node worker + control-plane — and the worker holds a live Claude session while the autonomous run itself spends tokens. It is **on-demand, not resident**: bring it up for the validation window, **tear it down when the run(s) finish**. Left up, it's the single largest reclaimable footprint on a shared host and quietly keeps a Claude seat warm.

- **On a host managed by `aep-stack` (systemd):** `aep-stack up` to preflight, **`aep-stack down` when done** — stops the services; the `--rm` postgres/temporal containers are removed, so state resets on the next `up` (fine — each run is fresh anyway).
- **Otherwise:** stop the `yarn dev:*` processes and `docker rm -f mm-aep-postgres-dev mm-aep-temporal-dev`.
- **Tear down on every exit path** — pass, refutation, *or* abort. A failed or abandoned run leaves the stack up exactly as much as a passing one; the usual leak is walking away after a refutation without stopping it.
