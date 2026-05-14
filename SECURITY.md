# Security policy

This repo contains agent instructions and prompt templates only — no
runtime code that ships in MetaMask products. Reports about the **content**
of a skill (e.g., guidance that could lead to insecure code) are welcome.

For vulnerabilities in shipped MetaMask products, follow the disclosure
flow at https://metamask.io/security/.

## Reporting an issue with a skill

- Open a public issue on https://github.com/MetaMask/skills/issues if the
  problem is non-sensitive (typo, outdated reference, broken link).
- Email `security@metamask.io` if the skill instructs an agent to perform
  an action with safety implications (e.g., bypassing review controls,
  leaking secrets, weakening test coverage), so a maintainer can patch
  before discussion is public.

## Out of scope

- The installer scripts (`tools/install`, `tools/sync`, `tools/deploy`,
  `tools/bootstrap`) run locally on engineer machines or cloud agents and
  do not handle credentials. Treat bugs as ordinary issues.
- Skills are advisory — agents and reviewers are expected to apply
  judgment. A skill recommendation is not a security guarantee.
