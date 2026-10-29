# Recipe skill development

The recipe skills are maintained in `MetaMask/skills` under `domains/perps/skills/`. Install this branch into a clean target with the repository installer and `--domain perps --maturity experimental`.

Run the domain checks from the repository root:

```sh
node --test domains/perps/skills/recipe-cook/scripts/tests/*.test.mjs domains/perps/skills/recipe-qa/scripts/*.test.mjs domains/perps/skills/recipe-pretty-pr/scripts/tests/*.test.cjs
```

Set `MM_HARNESS_BIN` to the real path of a published `mm-harness` executable to include the published-runtime checks. Without it, only those checks skip. Root CI currently discovers `test/*.test.mjs`, so run this domain command separately.
