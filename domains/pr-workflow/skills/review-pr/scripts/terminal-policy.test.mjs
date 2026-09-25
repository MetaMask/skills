import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const SCRIPT_ROOT = dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = join(SCRIPT_ROOT, "..");
const ALLOWED_COMMAND = /^node <skill-root>\/scripts\/[a-z0-9-]+\.mjs(?:\s+.*)?$/u;

const markdownFiles = (directory) =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return markdownFiles(path);
    }
    return entry.name.endsWith(".md") ? [path] : [];
  });

export const terminalExamples = (markdown) =>
  [...markdown.matchAll(/```(?:bash|sh|shell)\n(?<body>[\s\S]*?)```/gu)]
    .flatMap((match) => match.groups.body.split("\n"))
    .map((line) => line.trim())
    .filter(Boolean);

test("installed review instructions expose only checked-in scripts", () => {
  const mainInstruction = ["skill.md", "RULE.md", "SKILL.md"]
    .map((name) => join(SKILL_ROOT, name))
    .find(existsSync);
  assert.ok(mainInstruction);

  const instructionFiles = [
    mainInstruction,
    ...markdownFiles(join(SKILL_ROOT, "references")),
    ...(existsSync(join(SKILL_ROOT, "repos")) ? markdownFiles(join(SKILL_ROOT, "repos")) : []),
  ];
  const commands = instructionFiles.flatMap((path) => terminalExamples(readFileSync(path, "utf8")));

  assert.ok(commands.length > 0);
  assert.deepEqual(
    commands.filter((command) => !ALLOWED_COMMAND.test(command)),
    [],
  );
});
