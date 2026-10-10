---
repo: core
parent: controller-guidelines
---

# Controller guidelines — core

- API response handling: test both failure shapes, a thrown error and a non-`ok` result the caller wraps.
- Classify a public type change by `AGENTS.md` ("changes the signature of any public export"), not by neighbouring code. Widening an exported union breaks exhaustive `Record<Union, …>` consumers.
