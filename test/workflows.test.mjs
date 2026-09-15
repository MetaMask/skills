import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, test } from 'node:test';

const WORKFLOWS = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '.github',
  'workflows',
);

// `uses: owner/repo@ref` and `uses: owner/repo/path/to.yml@ref`, but not `uses: ./local`.
const EXTERNAL_USES = /^\s*-?\s*uses:\s*([A-Za-z0-9_.-]+\/[A-Za-z0-9_./-]+)@(\S+)/u;
const COMMIT_SHA = /^[0-9a-f]{40}$/u;

function workflowFiles() {
  return readdirSync(WORKFLOWS)
    .filter((name) => name.endsWith('.yml') || name.endsWith('.yaml'))
    .map((name) => ({ name, body: readFileSync(path.join(WORKFLOWS, name), 'utf8') }));
}

function externalRefs() {
  const refs = [];
  for (const { name, body } of workflowFiles()) {
    body.split('\n').forEach((line, i) => {
      const m = EXTERNAL_USES.exec(line);
      if (m) {
        refs.push({ file: name, line: i + 1, action: m[1], ref: m[2], raw: line.trim() });
      }
    });
  }
  return refs;
}

describe('workflow action references', () => {
  // A tag is a moving pointer: whoever controls the action repo can repoint `@v3` at new
  // code, and every workflow here picks it up on the next run with no diff and no review.
  // That is the vector behind the tj-actions/changed-files compromise. A hash cannot move.
  test('every external action is pinned to a commit hash', () => {
    const floating = externalRefs()
      .filter((r) => !COMMIT_SHA.test(r.ref))
      .map((r) => `${r.file}:${r.line} → ${r.action}@${r.ref}`);
    assert.deepEqual(
      floating,
      [],
      'pin to the full 40-character commit hash, with the tag in a trailing comment '
        + '(e.g. `uses: owner/action@<sha> # v1.2.3`)',
    );
  });

  // A bare hash is unreadable — nobody can tell v3.5.0 from a random commit at a glance,
  // and Dependabot uses the comment to know which tag the pin is tracking.
  test('every pinned action records its version in a trailing comment', () => {
    const unlabelled = externalRefs()
      .filter((r) => COMMIT_SHA.test(r.ref))
      .filter((r) => !/#\s*v?\d+(\.\d+)*/u.test(r.raw))
      .map((r) => `${r.file}:${r.line} → ${r.action}`);
    assert.deepEqual(unlabelled, [], 'add a trailing `# v<version>` comment beside the hash');
  });

  test('at least one external reference exists, so the checks above are not vacuous', () => {
    assert.ok(externalRefs().length > 0, 'expected external action references to check');
  });
});
