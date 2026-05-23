# Evidence Package

Use a small artifact directory per run. Do not commit it unless the repo workflow asks for checked-in evidence.

Recommended files:

- `recipe.json`: resolved recipe used for the run.
- `summary.json`: run status, command, environment, start/end time, and proof target results.
- `trace.json`: ordered node events with timestamps, status, and linked artifacts.
- `artifact-manifest.json`: reviewer-facing artifact index.

`artifact-manifest.json` shape:

```json
{
  "version": 1,
  "runStatus": "pass",
  "artifacts": [
    {
      "path": "screenshots/send-valid-amount.png",
      "type": "screenshot",
      "label": "Valid amount screen after error clears",
      "nodeId": "capture",
      "proofTarget": "PT-2",
      "mimeType": "image/png"
    }
  ]
}
```

Useful artifact types:

- `screenshot`
- `video`
- `log`
- `trace`
- `summary`
- `json`
- `report`
- `metric`
- `diff`
- `recipe`

Evidence rules:

- Store relative paths in the manifest.
- Link each artifact to a node and proof target.
- Capture screenshots only after a settle condition.
- Prefer logs/reports for backend claims and screenshots/videos for visible UI claims.
- Redact SRPs, private keys, bearer tokens, production account data, and private user data.
