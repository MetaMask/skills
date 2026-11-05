# Reading the MMDS components manifests

MMDS publishes a Storybook components manifest for each platform:

| Platform | Manifest |
| --- | --- |
| React (Extension) | <https://metamask.github.io/metamask-design-system/manifests/components.json> |
| React Native (Mobile) | <https://metamask.github.io/metamask-design-system/react-native/manifests/components.json> |

This file explains the format. It deliberately lists no components, versions,
or props: read those from the manifest and the installed package.

## What the manifest is

- It is generated from the Storybook build of MMDS `main`. It can be ahead of
  the version a consumer repo installs, so a component or prop in the manifest
  may not exist in `node_modules` yet. The installed types decide.
- It is large (around 1 MB). Fetch it once and search it, for example with
  `curl -s <url> | jq` or a script, rather than reading it whole.
- It is a discovery and deprecation index, not the API contract.

## Shape

```text
{
  "v": <format version>,
  "components": {
    "<story id>": {
      "id":          "<story id>",
      "name":        "<ComponentName>",
      "path":        "<story file in the MMDS repo>",
      "import":      "<import line(s) used by the stories>",
      "jsDocTags":   { "deprecated": ["<reason and replacement>"] },
      "reactDocgen": { "description": "...", "props": { "<prop>": { "required": ..., "tsType": ..., "description": "..." } } },
      "stories":     [ { "id": "...", "name": "...", "snippet": "<example JSX>" } ],
      "description": "<optional>",
      "error":       "<present instead of reactDocgen when docgen failed>"
    }
  },
  "meta": { ... }
}
```

Entries are keyed by Storybook story id, not by component name. Some entries
are design-token or foundation pages rather than components. Match on `name`.

## Common queries

- **Is there a component for X?** Search `name` and `reactDocgen.description`, then confirm
  the name is exported by the installed package index.
- **Is it deprecated?** A non-empty `jsDocTags.deprecated` means deprecated;
  the message names the replacement. Also check for `@deprecated` in the
  installed `.types` file, because the installed version may differ.
- **Which props does it take?** `reactDocgen.props` gives names, types,
  `required`, and descriptions for `main`. Confirm each prop in the installed
  types before using it.
- **How is it used?** `stories[].snippet` shows example JSX.

## Caveats

- `import` lines come from MMDS story files. They may import enums from
  `@metamask/design-system-shared` or use relative paths. In product code,
  import components and enums from the platform package
  (`@metamask/design-system-react` or `@metamask/design-system-react-native`).
- `jsDocTags` is `{}` when a component has no tags. An entry without a
  `deprecated` key is not deprecated in `main`; the installed version can
  still differ.
- An entry with `error` and no `reactDocgen` has no prop data. Read the
  installed types instead.
- Do not copy manifest content into a skill. It changes with every MMDS merge.
