# Recipe skill development

The recipe skills are maintained in `MetaMask/skills` under `domains/agentic/skills/`. Install this branch into a clean target with the repository installer and `--domain agentic --maturity experimental`.

Run the domain checks from the repository root:

```sh
node --test domains/agentic/skills/recipe-cook/scripts/tests/*.test.mjs domains/agentic/skills/recipe-qa/scripts/*.test.mjs domains/agentic/skills/recipe-pretty-pr/scripts/tests/*.test.cjs
```

Set `MM_HARNESS_BIN` to the real path of a published `mm-harness` executable to include the published-runtime checks. Without it, only those checks skip. This repository has no CI for them, so run this domain command directly.

Run the existing shell integration suites separately:

```sh
bash domains/agentic/skills/recipe-cook/scripts/tests/qa-install.test.sh
bash domains/agentic/skills/recipe-cook/scripts/tests/resolve-harness.test.sh
bash domains/agentic/skills/recipe-cook/scripts/tests/prepare-sandbox.test.sh
```

The catalog ID is `metamask-recipe-cook` in this public source. Retained tasks keep their recorded template references. The two thin dev/fix-bug entry points live with Cook. Recipe Harness uses `mm-harness`; its former Farmslot CLI fallback is omitted.
