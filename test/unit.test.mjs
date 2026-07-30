import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';

import {
  bodyAfterFrontmatter,
  collectSkills,
  domainMatches,
  expandHome,
  filterSkills,
  findSkill,
  formatSkillTable,
  getConfigValue,
  hasArg,
  isTruthy,
  maturityMatches,
  parseDiscoveryArgs,
  parseFrontmatter,
  parseGlobalArgs,
  inferRepoFromBasename,
  parseSkillsLocal,
  repoNameFromGitHubUrl,
  shouldSkipPostinstall,
  splitList,
  stripInlineComment,
  unquote,
} from '../bin/metamask-skills.mjs';

describe('repoNameFromGitHubUrl', () => {
  test('parses https, ssh, .git, fragment, and trailing forms', () => {
    assert.equal(repoNameFromGitHubUrl('https://github.com/MetaMask/skills.git'), 'skills');
    assert.equal(repoNameFromGitHubUrl('https://github.com/MetaMask/metamask-mobile'), 'metamask-mobile');
    assert.equal(repoNameFromGitHubUrl('git@github.com:MetaMask/core.git'), 'core');
    assert.equal(repoNameFromGitHubUrl('https://github.com/MetaMask/skills.git#main'), 'skills');
    assert.equal(repoNameFromGitHubUrl('https://github.com/MetaMask/skills/tree/main'), 'skills');
  });

  test('parses ssh host aliases used by multi-account git configs', () => {
    assert.equal(
      repoNameFromGitHubUrl('git@github.com-abretonc7s:MetaMask/metamask-mobile.git'),
      'metamask-mobile',
    );
  });

  test('returns undefined for non-github urls', () => {
    assert.equal(repoNameFromGitHubUrl('https://example.com/foo/bar'), undefined);
    assert.equal(repoNameFromGitHubUrl(''), undefined);
  });
});

describe('inferRepoFromBasename', () => {
  test('maps numbered farm slot directories to skill overlay repo names', () => {
    assert.equal(inferRepoFromBasename('/work/metamask-mobile-3'), 'metamask-mobile');
    assert.equal(inferRepoFromBasename('/work/metamask-extension-2'), 'metamask-extension');
    assert.equal(inferRepoFromBasename('/work/core-5'), 'metamask-core');
  });

  test('returns undefined for unrelated directory names', () => {
    assert.equal(inferRepoFromBasename('/work/metamask-extension-historical-pr3'), undefined);
    assert.equal(inferRepoFromBasename('/work/my-app'), undefined);
  });
});

describe('.skills.local parsing', () => {
  test('parses keys, export prefix, quotes, and inline comments', () => {
    const parsed = parseSkillsLocal(
      [
        '# comment line',
        '',
        'METAMASK_SKILLS_TARGET_REPO=core',
        'export SKILLS_AUTO_UPDATE=1',
        'METAMASK_SKILLS_DIR="~/dev/skills"  # path',
        "QUOTED='value # not a comment'",
      ].join('\n'),
    );
    assert.deepEqual(parsed, {
      METAMASK_SKILLS_TARGET_REPO: 'core',
      SKILLS_AUTO_UPDATE: '1',
      METAMASK_SKILLS_DIR: '~/dev/skills',
      QUOTED: 'value # not a comment',
    });
  });

  test('ignores malformed lines', () => {
    assert.deepEqual(parseSkillsLocal('not a kv line\n=missingkey\n123=ok'), {});
  });

  test('stripInlineComment respects quotes and leading hash', () => {
    assert.equal(stripInlineComment('value # trailing'), 'value');
    assert.equal(stripInlineComment('"a # b"'), '"a # b"');
    assert.equal(stripInlineComment('#whole-line'), '');
    assert.equal(stripInlineComment('val#nospace'), 'val#nospace');
  });

  test('unquote strips matching quotes only', () => {
    assert.equal(unquote('"x"'), 'x');
    assert.equal(unquote("'x'"), 'x');
    assert.equal(unquote('x'), 'x');
    assert.equal(unquote('"mismatch\''), '"mismatch\'');
  });
});

describe('isTruthy', () => {
  test('matches 1/true/yes case-insensitively', () => {
    for (const v of ['1', 'true', 'TRUE', 'Yes']) {
      assert.equal(isTruthy(v), true);
    }
    for (const v of ['0', 'false', 'no', '', undefined]) {
      assert.equal(isTruthy(v), false);
    }
  });
});

describe('expandHome', () => {
  test('expands ~ and ~/path, leaves others', () => {
    assert.equal(expandHome('~'), os.homedir());
    assert.equal(expandHome('~/dev'), path.join(os.homedir(), 'dev'));
    assert.equal(expandHome('/abs/path'), '/abs/path');
    assert.equal(expandHome(''), '');
  });
});

describe('getConfigValue', () => {
  test('env takes precedence over local config', () => {
    assert.equal(getConfigValue({ K: 'env' }, { K: 'local' }, 'K'), 'env');
    assert.equal(getConfigValue({}, { K: 'local' }, 'K'), 'local');
    assert.equal(getConfigValue({ K: '' }, { K: 'local' }, 'K'), '');
  });
});

describe('frontmatter', () => {
  const doc = ['---', 'name: my-skill', 'description: line one', '  continued', 'maturity: stable', '---', 'Body text', 'more'].join('\n');

  test('parseFrontmatter reads keys and folds continuations', () => {
    const meta = parseFrontmatter(doc);
    assert.equal(meta.name, 'my-skill');
    assert.equal(meta.description, 'line one continued');
    assert.equal(meta.maturity, 'stable');
  });

  test('parseFrontmatter returns empty without leading ---', () => {
    assert.deepEqual(parseFrontmatter('no frontmatter here'), {});
  });

  test('bodyAfterFrontmatter returns trimmed body', () => {
    assert.equal(bodyAfterFrontmatter(doc), 'Body text\nmore');
    assert.equal(bodyAfterFrontmatter('plain'), 'plain');
  });
});

describe('maturityMatches', () => {
  test('stable minimum includes stable, deprecated, and unset', () => {
    assert.equal(maturityMatches('stable', 'stable'), true);
    assert.equal(maturityMatches('deprecated', 'stable'), true);
    assert.equal(maturityMatches(undefined, 'stable'), true);
    assert.equal(maturityMatches('experimental', 'stable'), false);
  });

  test('experimental minimum includes everything', () => {
    assert.equal(maturityMatches('experimental', 'experimental'), true);
  });

  test('deprecated minimum only matches deprecated', () => {
    assert.equal(maturityMatches('deprecated', 'deprecated'), true);
    assert.equal(maturityMatches('stable', 'deprecated'), false);
  });
});

describe('list helpers', () => {
  test('splitList trims and drops empties', () => {
    assert.deepEqual(splitList('a, b ,,c'), ['a', 'b', 'c']);
    assert.deepEqual(splitList(undefined), []);
  });

  test('domainMatches with empty filter matches all', () => {
    assert.equal(domainMatches('testing', ''), true);
    assert.equal(domainMatches('testing', 'testing,agentic'), true);
    assert.equal(domainMatches('other', 'testing'), false);
  });
});

describe('arg parsing', () => {
  test('parseGlobalArgs extracts target, repo, and passthrough', () => {
    const { target, repo, passthrough } = parseGlobalArgs(['--repo', 'core', '--include', 'a/b', '--target', '/tmp/x']);
    assert.equal(repo, 'core');
    assert.equal(target, path.resolve('/tmp/x'));
    assert.deepEqual(passthrough, ['--repo', 'core', '--include', 'a/b', '--target', path.resolve('/tmp/x')]);
  });

  test('parseDiscoveryArgs defaults and flags', () => {
    const opts = parseDiscoveryArgs(['search', 'unit', '--all']);
    assert.equal(opts.maturity, 'experimental');
    assert.equal(opts.includeInapplicable, true);
    assert.deepEqual(opts.terms, ['search', 'unit']);
  });

  test('parseDiscoveryArgs rejects invalid maturity', () => {
    assert.throws(() => parseDiscoveryArgs(['--maturity', 'bogus']), /maturity/u);
  });

  test('hasArg detects a flag', () => {
    assert.equal(hasArg(['--repo', 'x'], '--repo'), true);
    assert.equal(hasArg(['--target', 'x'], '--repo'), false);
  });
});

describe('shouldSkipPostinstall', () => {
  test('skips when explicitly disabled or in CI without force', () => {
    assert.equal(shouldSkipPostinstall({ SKILLS_SKIP_POSTINSTALL: '1' }), true);
    assert.equal(shouldSkipPostinstall({ CI: 'true' }), true);
    assert.equal(shouldSkipPostinstall({ CI: 'true', SKILLS_FORCE_POSTINSTALL: '1' }), false);
    assert.equal(shouldSkipPostinstall({}), false);
  });
});

describe('findSkill / filterSkills / formatSkillTable', () => {
  const skills = [
    { id: 'testing/unit-testing', name: 'unit-testing', installedName: 'mms-unit-testing', domain: 'testing', maturity: 'stable', scope: 'project', repoApplicable: true, description: 'Unit tests' },
    { id: 'agentic/recipe', name: 'recipe', installedName: 'mms-recipe', domain: 'agentic', maturity: 'experimental', scope: 'project', repoApplicable: false, description: 'Recipe' },
  ];

  test('findSkill matches id, name, and installed name', () => {
    assert.equal(findSkill(skills, 'testing/unit-testing').length, 1);
    assert.equal(findSkill(skills, 'unit-testing').length, 1);
    assert.equal(findSkill(skills, 'mms-unit-testing').length, 1);
    assert.equal(findSkill(skills, 'nope').length, 0);
  });

  test('filterSkills honors maturity, domain, and applicability', () => {
    const stableOnly = filterSkills(skills, { maturity: 'stable', includeInapplicable: false });
    assert.deepEqual(stableOnly.map((s) => s.id), ['testing/unit-testing']);
    const all = filterSkills(skills, { maturity: 'experimental', includeInapplicable: true });
    assert.equal(all.length, 2);
    const domainFiltered = filterSkills(skills, { maturity: 'experimental', includeInapplicable: true, domain: 'agentic' });
    assert.deepEqual(domainFiltered.map((s) => s.id), ['agentic/recipe']);
  });

  test('formatSkillTable renders header and empty state', () => {
    assert.match(formatSkillTable(skills), /skill\s+maturity\s+scope\s+description/u);
    assert.match(formatSkillTable([]), /No skills matched/u);
  });
});

describe('collectSkills (fixture)', () => {
  let root;

  before(() => {
    root = mkdtempSync(path.join(os.tmpdir(), 'mms-skills-'));
    const skillDir = path.join(root, 'domains', 'testing', 'skills', 'unit-testing');
    mkdirSync(path.join(skillDir, 'repos'), { recursive: true });
    writeFileSync(
      path.join(skillDir, 'skill.md'),
      ['---', 'name: unit-testing', 'description: Write unit tests', 'maturity: stable', '---', 'Body.'].join('\n'),
    );
    writeFileSync(path.join(skillDir, 'repos', 'core.md'), '# core overlay\n');
  });

  after(() => {
    rmSync(root, { recursive: true, force: true });
  });

  test('reads skill metadata and computes repo applicability', () => {
    const [forCore] = collectSkills([root], 'core');
    assert.equal(forCore.id, 'testing/unit-testing');
    assert.equal(forCore.name, 'unit-testing');
    assert.equal(forCore.installedName, 'mms-unit-testing');
    assert.equal(forCore.description, 'Write unit tests');
    assert.deepEqual(forCore.repos, ['core']);
    assert.equal(forCore.repoApplicable, true);

    const [forOther] = collectSkills([root], 'metamask-mobile');
    assert.equal(forOther.repoApplicable, false);
  });

  test('returns empty for a source without skills', () => {
    assert.deepEqual(collectSkills([path.join(root, 'nonexistent')], 'core'), []);
  });
});
