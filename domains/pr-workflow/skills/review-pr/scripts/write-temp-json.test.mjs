import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { writeTempJson } from "./write-temp-json.mjs";

const SHA = "a".repeat(40);
const ignored = () => true;

test("writeTempJson creates an empty JSON file in the repository temp directory", () => {
  const repoRoot = mkdtempSync(join(tmpdir(), "review-pr-"));
  const path = writeTempJson({
    basename: `review-pr-${SHA}.json`,
    repoRoot,
    isIgnored: ignored,
  });

  assert.equal(path, join(repoRoot, "temp", `review-pr-${SHA}.json`));
  assert.equal(readFileSync(path, "utf8"), "{}\n");
});

test("writeTempJson accepts a pending-review manifest name", () => {
  const repoRoot = mkdtempSync(join(tmpdir(), "review-pr-"));
  const path = writeTempJson({
    basename: `review-pr-pending-${SHA}.json`,
    repoRoot,
    isIgnored: ignored,
  });

  assert.equal(readFileSync(path, "utf8"), "{}\n");
});

test("writeTempJson refuses a repository that does not ignore temp/", () => {
  const repoRoot = mkdtempSync(join(tmpdir(), "review-pr-"));

  assert.throws(
    () =>
      writeTempJson({
        basename: `review-pr-${SHA}.json`,
        repoRoot,
        isIgnored: () => false,
      }),
    /temp\/ is not gitignored/u,
  );
});

test("writeTempJson rejects a basename outside the two report names", () => {
  assert.throws(
    () =>
      writeTempJson({
        basename: "../review-pr.json",
        repoRoot: tmpdir(),
        isIgnored: ignored,
      }),
    /basename must be review-pr-/u,
  );
});
