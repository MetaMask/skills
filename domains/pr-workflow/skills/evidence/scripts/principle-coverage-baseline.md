<!-- VALIDATION_RUN_START -->
## 🧪 Validation Run

> Trial run of an experimental evidence skill — feedback via MetaMask/skills.

**Verdict:** proven — **Claim:** the selector stops recomputing on unrelated writes.
Measured 3 recomputations before and 1 after: ![capture](https://github.com/user-attachments/assets/1f2e3d4c-aaaa-bbbb-cccc-ddddeeeeffff) — `evidence-artifacts/recompute.json`

Environment: head `7bfc16c`, node `v20.11.0`.

Not covered by this run: one fixture, one perturbed key; a selector unmoved here can still
recompute under state this fixture does not reach.
<!-- VALIDATION_RUN_END -->
