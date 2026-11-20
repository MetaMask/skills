---
repo: metamask-mobile
parent: component-structure
---

## MetaMask Mobile

### Folder convention (R1, R3)

```text
<Name>/
  <Name>.tsx            # composition only
  <Name>.types.ts
  <Name>.styles.ts      # or Tailwind via useTailwind()
  <Name>.testIds.ts
  index.ts
  use<Name>.ts          # state, async flows, handlers; returns { state, actions }
  use<Name>.test.ts
  components/
    <Sub>/<Sub>.tsx
```

Many older screens live in `<Name>/index.tsx`. When restructuring one, move to `<Name>/<Name>.tsx` plus `index.ts` only if the change already touches the file's imports.

### React and React Compiler (R7)

- React 19. React Compiler covers all app code and is off under Jest, so tests do not exercise compiled output.
- ESLint: `react-compiler/react-compiler` is `warn`; `react-hooks/exhaustive-deps` is `off`. Dependency lists on manual memoization are not checked, which is another reason not to add them.
- Bailout log: run Metro or a build with `REACT_COMPILER_LOG_FAILURES=true`; failures go to `react-compiler.log`. A file with a bailout on its current code is an R7 exception until fixed with `mms-react-compiler-migration`. The log is local, git-ignored and append-only, so it keeps entries from older code and other branches; an entry on its own is not proof. Treat the file as excepted only when the bailout is confirmed on the current code: the log was regenerated after the current checkout, or `react-compiler/react-compiler` reports the file. If neither is confirmed, report the R7 finding and name the possible bailout in the finding.
- R7 exception: `useFocusEffect(useCallback(() => { ... }, [deps]))` from React Navigation needs a stable callback. Keep it. A focus effect responds to a navigation event, so it is not an R4 finding either.

### Copy

- `strings('key')` from `locales/i18n`. Call it at render or inside a function called at render.

### Navigation (R3)

- React Navigation: `useNavigation`, `useRoute`, `useFocusEffect`. Navigation decisions after an async flow belong in `use<Screen>`, which can call `useNavigation()` itself.

### Async (R4)

- `@tanstack/react-query` with the shared `QueryClient` from `app/core/ReactQueryService`. Use `useQuery` for async reads instead of an effect with a `cancelled` flag.
- Engine controller calls triggered by the user (`Engine.context.X.method()`) belong in handlers inside `use<Screen>`, not in effects.

### Testing extracted code

- Follow `mms-mobile-testing` for the layer: a component-view test for the screen, a unit test for a pure `use<Screen>` reducer or helper.
