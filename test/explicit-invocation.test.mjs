import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const installer = process.env.SKILLS_INSTALLER || fileURLToPath(new URL('../tools/install', import.meta.url));

test('explicit-only policy survives install, overlay and reinstall on every target', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'skills-invocation-'));
  try {
    const source = path.join(root, 'source');
    const target = path.join(root, 'target');
    const userRoot = path.join(root, 'user');
    for (const dir of [target, `${userRoot}/.claude`, `${userRoot}/.codex`]) mkdirSync(dir, { recursive: true });
    // Isolate home destinations without changing HOME or writing operator skills.
    const isolatedInstaller = path.join(root, 'install');
    writeFileSync(isolatedInstaller, readFileSync(installer, 'utf8').replaceAll('$HOME/.claude', `${userRoot}/.claude`).replaceAll('$HOME/.codex', `${userRoot}/.codex`));
    function skill(name, explicit, scope = '') {
      const dir = path.join(source, 'domains/test/skills', name);
      mkdirSync(dir, { recursive: true });
      writeFileSync(path.join(dir, 'skill.md'), `---\nname: ${name}\ndescription: Test workflow\nmaturity: stable\n${scope ? `scope: ${scope}\n` : ''}${explicit ? 'disable-model-invocation: true\n' : ''}---\n# Workflow\nDo the requested work.\n`);
      return dir;
    }
    const workflow = skill('workflow', false);
    skill('reference', false);
    skill('personal', true, 'user');
    skill('recipe-pr-qa-review', false);
    mkdirSync(path.join(workflow, 'repos'));
    writeFileSync(path.join(workflow, 'repos/core.md'), '# Core context\nUse the configured target.\n');
    function install(...extra) {
      const result = spawnSync('/bin/bash', [isolatedInstaller, '--source', source, '--target', target, '--repo', 'core', '--include-user', ...extra], { encoding: 'utf8' });
      assert.equal(result.status, 0, result.stdout + result.stderr);
    }
    const agentFile = `${target}/.agents/skills/mms-workflow/agents/openai.yaml`;
    install();
    const oldSkill = `${target}/.agents/skills/mms-recipe-pr-qa-review`;
    assert.ok(existsSync(oldSkill));
    rmSync(path.join(source, 'domains/test/skills/recipe-pr-qa-review'), { recursive: true });
    skill('recipe-qa', true);
    install('--dry-run');
    assert.ok(existsSync(oldSkill));
    install();
    for (const base of ['.agents/skills', '.claude/skills', '.cursor/rules']) {
      assert.equal(existsSync(`${target}/${base}/mms-recipe-pr-qa-review`), false);
    }
    mkdirSync(oldSkill);
    writeFileSync(path.join(oldSkill, 'SKILL.md'), '# Hand-authored custom skill');
    install();
    assert.ok(existsSync(oldSkill), 'never delete hand-authored skills');
    assert.ok(!readFileSync(agentFile, 'utf8').includes('allow_implicit_invocation: false'));
    skill('workflow', true);
    install('--dry-run');
    assert.ok(!readFileSync(agentFile, 'utf8').includes('allow_implicit_invocation: false'));
    install();
    for (const base of ['.claude/skills', '.agents/skills']) {
      const text = readFileSync(`${target}/${base}/mms-workflow/SKILL.md`, 'utf8');
      assert.match(text, /^disable-model-invocation: true$/m);
      assert.match(text, /Core context/);
      assert.doesNotMatch(readFileSync(`${target}/${base}/mms-reference/SKILL.md`, 'utf8'), /disable-model-invocation/);
    }
    assert.match(readFileSync(agentFile, 'utf8'), /policy:\n  allow_implicit_invocation: false/);
    const cursor = `${target}/.cursor/rules/mms-workflow`;
    const frontmatter = readFileSync(`${cursor}/mms-workflow.mdc`, 'utf8').split('---')[1];
    assert.match(frontmatter, /alwaysApply: false/);
    assert.doesNotMatch(frontmatter, /description:|globs:/);
    assert.equal(existsSync(`${cursor}/RULE.md`), false);
    assert.match(readFileSync(`${userRoot}/.claude/skills/mms-personal/SKILL.md`, 'utf8'), /disable-model-invocation: true/);
    assert.match(readFileSync(`${userRoot}/.codex/skills/mms-personal/agents/openai.yaml`, 'utf8'), /allow_implicit_invocation: false/);
    skill('workflow', false);
    skill('personal', false, 'user');
    install();
    assert.equal(existsSync(`${cursor}/mms-workflow.mdc`), false);
    assert.ok(existsSync(`${cursor}/RULE.md`));
    assert.doesNotMatch(readFileSync(agentFile, 'utf8'), /allow_implicit_invocation: false/);
    assert.doesNotMatch(readFileSync(`${userRoot}/.codex/skills/mms-personal/agents/openai.yaml`, 'utf8'), /allow_implicit_invocation: false/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
