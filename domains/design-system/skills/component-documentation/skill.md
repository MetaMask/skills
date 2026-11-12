---
name: component-documentation
description: >-
  Storybook story and README standards for MetaMask Design System (MMDS)
  components on React and React Native: Default story first, one story per
  major prop, practical argTypes controls, README.mdx (React) and README.md
  (React Native) from the repo templates, consumer-facing descriptions, and
  identical structure across platforms. Use when writing or reviewing MMDS
  stories, argTypes, or component READMEs.
maturity: stable
---

# MMDS stories and READMEs

Consumers read a component's README on GitHub at the tag of the version they
installed (READMEs are not in the npm tarball), and agents read stories
through the hosted components manifest. Write both for them.

Lookup order: `knowledge/mmds-sources.md` (source:
[`../../knowledge/mmds-sources.md`](../../knowledge/mmds-sources.md)).
Sample copy follows `content-guidelines`.

## When to use

- Adding or changing a component's stories or README.
- Reviewing documentation in an MMDS PR.

## Workflow

1. Start from the README template for the platform (see the overlay) and an
   existing component whose docs match on both platforms. `Box` is a good
   reference: same props, story names, and README structure on web and
   native.
2. Write the stories, then the README, then run the checklist.

## READMEs

- React: `README.mdx` with Storybook Canvas blocks; each prop section
  references its story. React Native: `README.md` with written examples for
  each usage pattern.
- Same sections on both platforms (description, props, usage,
  accessibility), the same props documented, and the same const names.
- Usage examples use the component-scoped const (`ComponentNameSize`), never a
  base scale or a sibling's const.
- The opening description is for consumers. Say what the component is, when
  to use it, how to use it in the common case, and when not to use it if
  there is a nearby alternative or a common misuse.
- Never include review history, implementation reasoning, or "why we changed
  X" narration. Mention implementation only when it changes how a consumer
  uses the API.

```text
✅ "<ComponentName> shows <what>. Use it when <situation>; for <other
    situation>, use <alternative>."
❌ "We removed the wrapper during review so the content is no longer clipped."
```

## Stories

- `Default` comes first, with minimal args and interactive controls wired
  for the props that are practical to edit.
- One story per major prop, named after the prop in PascalCase (`variant` →
  `Variant`, `isDisabled` → `IsDisabled`).
- Meta has `title`, `component`, `parameters`, and `argTypes`. React meta puts
  the README in `parameters.docs.page`.
- No stories for `className` or `twClassName`; document those in the README.

### Controls (both platforms)

- Wire `argTypes` only for props that are practical to edit (text, boolean,
  select).
- Do not use `control: 'object'` for pass-through props (nested props
  objects, `style`). Document them in the README.
- Omit non-interactive props instead of listing `control: false`.
- React Native may list fewer controls than web. On-device panels work best
  small.
- For const-object unions on React Native, use
  `options: Object.keys(Const)` with `mapping: Const`. Never pass the object
  itself as `options`.
- Keep `argTypes` descriptions where they help a reader of the controls
  panel.

Keep story names and coverage aligned across platforms where possible.

## Checklist

- [ ] README from the template for the platform; same sections on both.
- [ ] Description is consumer-facing, with no review or implementation
      history.
- [ ] Sample copy follows `content-guidelines`.
- [ ] React README uses Canvas blocks; each prop section references its
      story; meta includes the README.
- [ ] `Default` story first with practical controls; a story per major prop.
- [ ] No `control: 'object'` for pass-through props; no styling-prop stories.
- [ ] Storybook builds and the Storybook accessibility tests pass.
