---
repo: metamask-extension
parent: component-structure
---

## MetaMask Extension

### Folder convention (R1, R3)

Folder and file names are kebab-case. Styling follows `mms-ui-development` (Tailwind; no new SCSS). This skill adds two things to the existing layout: the screen hook returns `{ state, actions }` and has its own test, and a sub-component split out under R1 goes in `components/<sub-name>/` next to the parent.

Follow the hook file naming already used in the folder; `use-<name>.ts` and `use<Name>.ts` both exist.

### React and React Compiler (R7)

- React 18. Examples and fixes must not use React 19-only APIs (`use`, `useActionState`, `useOptimistic`, `ref` as a prop).
- React Compiler runs only on the files matched by the `babel-plugin-react-compiler` override in `babel.config.js`, with `target: '18'`. Read that override for the current scope; it covers only part of the UI code and skips test, story and container files.
- R7 applies only inside that scope. Files outside it are not compiled, so manual memoization there is not an R7 finding.
- `react-hooks` lint rules are enforced, including `exhaustive-deps`. Do not silence them with `eslint-disable` to keep a mount-only effect; that is an R4 finding.

### Copy

- `const t = useI18nContext();` then `t('key')` at render. A list of labelled items built with `t()` is a derived value (R2), not module data.

### Navigation (R3)

- `react-router-dom` v6: `useNavigate`, `useParams`, `useLocation`. Navigation after an async flow belongs in `use<Screen>`.

### Async and state (R3, R4)

- `@tanstack/react-query` v5 for async reads instead of an effect with a `cancelled` flag.
- Redux `dispatch` of background actions triggered by the user belongs in handlers inside `use<Screen>`.

### Performance depth

- `mms-perf-react-compiler` and `mms-perf-hooks-effects` cover Extension compiler and hook performance in depth. This skill only sets the structure rules.

### Testing extracted code

- Follow `mms-extension-testing`: `renderHook` for `use<Screen>`, a `.test.tsx` next to each extracted component.
