# The standing blind spots — where `tsc` returns a false negative

Defects the compiler cannot report, independent of any particular PR. Unlike the
restated-type class, these need no substitution to find: they are properties of
the language and the config, and they are present in every file.

**Verified, not asserted.** The demonstration file below was typechecked against
`metamask-extension` at `7fafda0` with the repo's own `tsconfig.json`:

```
$ NODE_OPTIONS='--max-old-space-size=9216' npx tsc -p tsconfig.json --noEmit
$ echo $?
0
```

Every block in it is wrong. `tsc` reports **zero errors** on all ten.

---

## A. Unsoundness in the type system

### 1. Index access is not `| undefined`

```ts
const parts = host.split('.');
return parts[9];        // typed `string`; `undefined` at runtime
```

`arr[i]` and `record[key]` are typed as if the element always exists. Easy to underestimate how much surface this covers: every `.split()[n]`, every
lookup table, every `find`-then-index is an instance.

- **Flag:** `noUncheckedIndexedAccess` (not enabled in `metamask-extension`).
- **In review:** any index or dynamic key access on a path that can be empty or
  short. `parts[parts.length - 1]` is only safe if the array is provably non-empty.

### 2. Optional property vs. explicit `undefined`

```ts
type PopupState = { currentPopupId?: number };
const cleared: PopupState = { currentPopupId: undefined }; // accepted
```

`?:` means "may be absent"; without the strict flag it *also* accepts
present-and-undefined. Code that distinguishes the two (`'k' in obj`,
`Object.keys().length`, serialization that drops vs. writes `null`) breaks on a
distinction the type cannot express.

- **Flag:** `exactOptionalPropertyTypes` (not enabled).
- **In review:** persisted state and message payloads, where absent and
  `undefined` serialize differently.

### 3. Method parameters are bivariant

```ts
type MessageHandler = { handle(msg: { kind: 'booted' | 'connectivity' }): void };
const narrow: MessageHandler = { handle(msg: { kind: 'booted' }) { … } }; // accepted
```

`strictFunctionTypes` makes function *properties* contravariant but exempts
**method shorthand** — deliberately, for DOM/array compatibility. So a handler
that only accepts a narrow subtype satisfies a wide handler type and receives
values it declared it would not.

- **Fix:** declare callbacks as properties (`handle: (msg: …) => void`), which
  *is* checked.
- **In review:** any interface with method-shorthand callbacks, especially
  message/event handlers.

### 4. Arrays are covariant

```ts
const bases: Base[] = specials;   // Special[] → Base[], accepted
bases.push(new Base());           // `specials` now holds a non-Special
```

- **In review:** a narrower array widened and then mutated. `readonly T[]` blocks it.

### 5. Excess-property checking only fires on fresh literals

```ts
const draft = { url: 'a', justification: 'b', reasosn: ['typo'] };
const params: CreateParams = draft;   // no error — not a fresh literal
```

Assigning the literal directly would catch the typo. Through a variable, the
extra property is silently ignored — and the intended one is missing.

- **In review:** config/params objects built up in a variable before being passed.
  This is how a misspelled option key survives to runtime.

### 6. Structural typing erases domain distinctions

```ts
type AccountAddress = string;
type TransactionHash = string;
fetchBalance(txHash);   // accepted — both are `string`
```

Aliases are not nominal. Two semantically incompatible values are interchangeable
whenever their structure matches.

- **Fix:** branded types, or a template-literal type where the format differs
  (`Hex` = `` `0x${string}` `` genuinely does discriminate).
- **In review:** same-primitive parameters, especially adjacent ones in a
  signature, where swapping the arguments would still compile.

## B. Boundaries the compiler does not cross

### 7. `any` absorbs any annotation

```ts
declare function readPersisted(key: string): any;
const meta: VaultMeta = readPersisted('meta');   // asserted, never validated
meta.version.toFixed(2);                          // may be a string at runtime
```

An `any` satisfies every annotation silently. Sources: untyped dependencies,
`JSON.parse`, generics that default to `any`, and `as any`.

- **In review:** trace where a confidently-typed value *entered* the program. If
  it entered as `any`, its type is a wish.

### 8. Ambient `declare module` is an unverified assertion

```ts
declare module '@ensdomains/content-hash' {
  const contentHash: { decode: (h: string) => string /* … */ };
  export default contentHash;
}
```

Hand-written module declarations are believed unconditionally — nothing compares
them to the package. Getting a return type wrong here is invisible forever, and
the declaration is **global**, so it also shadows any real types the package
later ships.

- **In review:** read the package's actual source at the installed version when a
  `declare module` is added or changed. Prefer `@types/*` or a PR upstream.

### 9. External data is asserted, not validated

```ts
const chainId = (rpcResult as { chainId: string }).chainId.slice(2);
```

Every `as` on data crossing a boundary — RPC responses, `fetch().json()`,
`chrome.storage` reads, persisted state written by an *older version of the app* —
is a claim the compiler cannot evaluate.

- **In review:** highest stakes for persisted state and migrations, where the real
  input was produced by code that no longer exists. A runtime validator
  (`@metamask/superstruct`, zod) is the only thing that actually checks.

### 10. A JS caller is not checked at all

With `checkJs` off (the default, and the case in `metamask-extension`), a type
written for a function whose callers are still `.js` is compared against no call
site, ever. See the restated-type class in the main skill — this is why that class
exists.

## C. Config-level blind spots

Check these before trusting a green build. Values shown are `metamask-extension`
at the time of writing.

| Setting | Effect | Here |
|---|---|---|
| `skipLibCheck` | Errors *inside* `.d.ts` files are suppressed, including conflicts between library types | **`true`** (from `@tsconfig/node22`) |
| `exclude` | Excluded files are never typechecked | `**/*.stories.tsx`, `**/*.stories.ts` |
| `include` | Anything outside it is invisible to `tsc` | `app`, `development`, `shared`, `test`, `types`, `ui`, `*.ts` |
| `checkJs` | Off ⇒ `.js` callers unchecked | unset |
| `noEmit` + bundler | `tsc` never produces the shipped artifact; webpack/swc transpiles **without** typechecking, so a type error cannot break the build — only the separate `lint:tsc` job reports it | `noEmit: true` |
| `@ts-expect-error` / `@ts-ignore` | Point suppressions | grep before trusting a clean file |

The last row is worth stating plainly: **type errors do not break the build.** They
break a CI job. If that job is skipped, filtered, or its output is not read, the
types were never checked at all.

---

## The demonstration file

Drop this anywhere inside the `include` paths and typecheck. Zero errors is the
expected — and alarming — result.

```ts
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */

// 1. Index access is not `| undefined`
function lastSegment(host: string): string {
  const parts = host.split('.');
  return parts[9]; // typed `string`; `undefined` at runtime
}
export const seg = lastSegment('foo.eth').toUpperCase();

// 2. Record lookup claims the value always exists
declare const gateways: Record<string, { url: string }>;
export const gw = gateways.definitelyNotAKey.url;

// 3. Optional property accepts an explicit undefined
type PopupState = { currentPopupId?: number };
const cleared: PopupState = { currentPopupId: undefined };
export const idPlusOne = (cleared.currentPopupId ?? 0) + 1;

// 4. Method-shorthand parameters are bivariant
type MessageHandler = { handle(msg: { kind: 'booted' | 'connectivity' }): void };
const narrow: MessageHandler = { handle(msg: { kind: 'booted' }) {} };
export { narrow };

// 5. Arrays are covariant
class Base {}
class Special extends Base {
  special() {
    return 1;
  }
}
const specials: Special[] = [new Special()];
const bases: Base[] = specials;
bases.push(new Base());
export const boom = () => specials.map((s) => s.special());

// 6. Excess-property checking only fires on fresh literals
type CreateParams = { url: string; justification: string };
const draft = { url: 'a', justification: 'b', reasosn: ['typo'] };
export const params: CreateParams = draft;

// 7. `any` absorbs any annotation
declare function readPersisted(key: string): any;
type VaultMeta = { version: number; storageKind: 'data' | 'split' };
export const meta: VaultMeta = readPersisted('meta');
export const ver = meta.version.toFixed(2);

// 8. An ambient `declare module` is an unverified assertion
import contentHash from '@ensdomains/content-hash';

export const decoded: string = contentHash.decode('0x');

// 9. Structural typing erases domain distinctions
type AccountAddress = string;
type TransactionHash = string;
declare function fetchBalance(addr: AccountAddress): Promise<string>;
declare const txHash: TransactionHash;
export const wrong = fetchBalance(txHash);

// 10. A type assertion on external data is unchecked by construction
declare const rpcResult: unknown;
export const chainId = (rpcResult as { chainId: string }).chainId.slice(2);
```

## How to use the catalog in a review

Don't run all ten as a checklist. Pick by what the diff touches:

- **New indexing / destructuring** → 1, 2
- **New message, event, or callback types** → 3, 5, 6
- **New `declare module`, new dependency, `@types` change** → 8
- **Anything reading persisted state, storage, or an RPC response** → 7, 9
- **A JS→TS conversion** → 10, plus the restated-type class in the main skill
- **Any PR whose safety argument is "CI is green"** → section C, first
