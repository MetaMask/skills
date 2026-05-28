#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

function usage() {
  console.error('Usage: package-pr-evidence.js --task <task-dir> [--out <task-dir/pr-package>]');
}

function parseArgs(argv) {
  const args = { task: '', out: '' };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--task') args.task = argv[++i] || '';
    else if (arg === '--out') args.out = argv[++i] || '';
    else if (arg === '-h' || arg === '--help') { usage(); process.exit(0); }
    else throw new Error(`Unknown arg: ${arg}`);
  }
  return args;
}

function readText(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch (error) {
    if (error && error.code === 'ENOENT') return '';
    throw error;
  }
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    if (error && error.code === 'ENOENT') return null;
    throw error;
  }
}

function mkdirp(dir) { fs.mkdirSync(dir, { recursive: true }); }

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, acc);
    else if (entry.isFile()) acc.push(p);
  }
  return acc;
}

function rel(from, to) { return path.relative(from, to).split(path.sep).join('/'); }

function sanitizeName(s) {
  return String(s || 'artifact')
    .toLowerCase()
    .replace(/\.png(?:-\d+)?(?:\.png)?$/i, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/^-+|-+$/g, '') || 'artifact';
}

function stripRuntimePngSuffix(name) {
  return name.replace(/\.png-\d+\.png$/i, '.png');
}

function nearestRunDir(file) {
  let dir = path.dirname(file);
  while (dir && dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, 'summary.json')) || fs.existsSync(path.join(dir, 'screenshots-captions.json'))) return dir;
    dir = path.dirname(dir);
  }
  return path.dirname(file);
}

function captionFor(file) {
  const runDir = nearestRunDir(file);
  const captions = readJson(path.join(runDir, 'screenshots-captions.json')) || {};
  const base = path.basename(file);
  const stripped = stripRuntimePngSuffix(base);
  return captions[base] || captions[stripped] || stripped.replace(/\.png$/i, '').replace(/[-_]+/g, ' ');
}

function firstMatch(text, regex, fallback = '') {
  const match = text.match(regex);
  return match ? match[1].trim() : fallback;
}

function getRepoRoot(taskDir) {
  try {
    return execFileSync('git', ['-C', taskDir, 'rev-parse', '--show-toplevel'], { text: true, stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    let dir = taskDir;
    while (dir && dir !== path.dirname(dir)) {
      if (fs.existsSync(path.join(dir, '.git'))) return dir;
      dir = path.dirname(dir);
    }
    return '';
  }
}

function assertSafeOutDir(taskDir, outDir) {
  const relPath = path.relative(taskDir, outDir);
  if (!relPath || relPath.startsWith('..') || path.isAbsolute(relPath)) {
    throw new Error(`Refusing --out outside task dir or equal to task dir: ${outDir}`);
  }
  const parts = relPath.split(path.sep).filter(Boolean);
  if (parts[0] === 'artifacts' || parts[0] === 'harness') {
    throw new Error(`Refusing --out inside task source/artifact dir: ${outDir}`);
  }
  if (!/^pr-package(?:[-_.][a-zA-Z0-9-]+)?$/.test(path.basename(outDir))) {
    throw new Error(`Refusing --out that is not a generated pr-package directory: ${outDir}`);
  }
}

function findPrTemplate(repoRoot) {
  if (!repoRoot) return null;
  const candidates = [
    '.github/pull-request-template.md',
    '.github/pull_request_template.md',
    '.github/PULL_REQUEST_TEMPLATE.md',
  ];
  for (const relPath of candidates) {
    const abs = path.join(repoRoot, relPath);
    if (fs.existsSync(abs)) return { abs, relPath };
  }
  return null;
}

function insertAfterHeading(markdown, headingPattern, block) {
  const match = markdown.match(headingPattern);
  if (!match || match.index === undefined) return markdown;
  const lineEnd = markdown.indexOf('\n', match.index);
  const insertAt = lineEnd === -1 ? markdown.length : lineEnd + 1;
  return `${markdown.slice(0, insertAt)}\n${block}\n${markdown.slice(insertAt)}`;
}

function insertBeforeHeading(markdown, headingPattern, block) {
  const match = markdown.match(headingPattern);
  if (!match || match.index === undefined) return `${markdown}\n\n${block}\n`;
  return `${markdown.slice(0, match.index)}${block}\n\n${markdown.slice(match.index)}`;
}

function buildImageSlots(copied, headingLevel = '###') {
  if (!copied.length) {
    return '<!-- No screenshot files were found under artifacts/**/screenshots. Add visual evidence before claiming visual ACs. -->\n';
  }
  return copied.map((item, i) => [
    `${headingLevel} ${i + 1}. ${item.caption}`,
    '',
    `<!-- IMAGE_SLOT_${String(i + 1).padStart(2, '0')}: drag/drop \`pr-package/images/${item.name}\` here in GitHub, then keep the uploaded image markdown below. -->`,
    '',
    `Local file: \`pr-package/images/${item.name}\``,
    '',
  ].join('\n')).join('\n');
}

function buildTemplatePrDesc({ templateText, templateRelPath, task, verdict, taskDir, outDir, copied, evidenceExists, qualityExists, checklistExists }) {
  const descriptionBlock = [
    '<!-- recipe-evidence suggestion: edit as needed before publishing. -->',
    task ? `This PR addresses ${task}.` : 'This PR addresses the linked task.',
    'See the validation and evidence sections below for recipe-backed proof.',
  ].join('\n');

  const validationBlock = [
    '<!-- recipe-evidence validation summary: keep commands concise; full paths are in pr-package/evidence.md. -->',
    verdict ? `Verdict: \`${verdict}\`` : 'Verdict: `TODO`',
    '- See `pr-package/evidence.md` for recipe commands, summaries, traces, and artifact manifests.',
    evidenceExists ? '- Full evidence package: `pr-package/evidence.md`' : '- Full evidence package: TODO (`PR-READY-EVIDENCE.md` was missing at package time).',
    qualityExists ? '- Quality report: `pr-package/recipe-quality.md`' : '- Quality report: TODO (`artifacts/RECIPE-QUALITY.md` was missing at package time).',
  ].join('\n');

  const screenshotBlock = [
    '### **Recipe evidence**',
    '',
    `<!-- Generated from ${templateRelPath}. Drag/drop each local image file at its marker so GitHub uploads and renders it. -->`,
    '',
    buildImageSlots(copied, '####'),
  ].join('\n');

  const artifactBlock = [
    '## **Recipe artifact package**',
    '',
    `Task path: \`${taskDir}\``,
    `PR package: \`${outDir}\``,
    evidenceExists ? '- Full evidence: `pr-package/evidence.md`' : '- Full evidence: missing `PR-READY-EVIDENCE.md` at package time',
    qualityExists ? '- Quality report: `pr-package/recipe-quality.md`' : '- Quality report: missing `artifacts/RECIPE-QUALITY.md` at package time',
    '- Image files: `pr-package/images/`',
    checklistExists ? '- Checklist: `pr-package/checklist.md`' : '- Checklist: missing `CHECKLIST.md` at package time',
  ].join('\n');

  let out = templateText;
  out = insertAfterHeading(out, /^## \*\*Description\*\*\s*$/m, descriptionBlock);
  if (task) out = out.replace(/^Fixes:\s*$/m, `Fixes: ${task}\n`);
  out = insertAfterHeading(out, /^## \*\*Manual testing steps\*\*\s*$/m, validationBlock);
  out = insertBeforeHeading(out, /^## \*\*Pre-merge author checklist\*\*\s*$/m, screenshotBlock);
  out = insertBeforeHeading(out, /^## \*\*Pre-merge author checklist\*\*\s*$/m, artifactBlock);
  return out;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.task) {
    usage();
    process.exit(2);
  }
  const taskDir = path.resolve(args.task);
  if (!fs.existsSync(taskDir) || !fs.statSync(taskDir).isDirectory()) {
    throw new Error(`Task dir not found: ${taskDir}`);
  }
  const repoRoot = getRepoRoot(taskDir);
  const prTemplate = findPrTemplate(repoRoot);
  const outDir = path.resolve(args.out || path.join(taskDir, 'pr-package'));
  assertSafeOutDir(taskDir, outDir);
  const imagesDir = path.join(outDir, 'images');
  fs.rmSync(outDir, { recursive: true, force: true });
  mkdirp(imagesDir);

  const evidenceSrc = path.join(taskDir, 'PR-READY-EVIDENCE.md');
  const evidenceText = readText(evidenceSrc);
  const checklist = readText(path.join(taskDir, 'CHECKLIST.md'));
  const textSource = evidenceText || checklist;
  const task = firstMatch(textSource, /Task:\s*`?([^`\n]+)`?/i, firstMatch(checklist, /Source:\s*`?([^`\n]+)`?/i, ''));
  const branch = firstMatch(textSource, /Branch:\s*`?([^`\n]+)`?/i, firstMatch(checklist, /Run branch:\s*`?([^`\n]+)`?/i, ''));
  const verdict = firstMatch(textSource, /Verdict:\s*`?([^`\n]+)`?/i, '');

  const screenshots = walk(path.join(taskDir, 'artifacts'))
    .filter((file) => /\.(png|jpg|jpeg|webp)$/i.test(file))
    .filter((file) => file.split(path.sep).includes('screenshots'))
    .sort();

  const copied = [];
  const seen = new Set();
  screenshots.forEach((file, index) => {
    const caption = captionFor(file);
    const baseName = sanitizeName(caption || path.basename(file));
    let destName = `${String(index + 1).padStart(2, '0')}-${baseName}${path.extname(file).toLowerCase() || '.png'}`;
    let n = 2;
    while (seen.has(destName)) {
      destName = `${String(index + 1).padStart(2, '0')}-${baseName}-${n}${path.extname(file).toLowerCase() || '.png'}`;
      n += 1;
    }
    seen.add(destName);
    const dest = path.join(imagesDir, destName);
    fs.copyFileSync(file, dest);
    copied.push({ source: file, dest, name: destName, caption, runDir: nearestRunDir(file) });
  });

  if (fs.existsSync(evidenceSrc)) fs.copyFileSync(evidenceSrc, path.join(outDir, 'evidence.md'));
  const qualitySrc = path.join(taskDir, 'artifacts', 'RECIPE-QUALITY.md');
  if (fs.existsSync(qualitySrc)) fs.copyFileSync(qualitySrc, path.join(outDir, 'recipe-quality.md'));
  const checklistSrc = path.join(taskDir, 'CHECKLIST.md');
  const checklistExists = fs.existsSync(checklistSrc);
  if (checklistExists) fs.copyFileSync(checklistSrc, path.join(outDir, 'checklist.md'));

  const imageReadme = [
    '# Evidence images',
    '',
    'Copy or drag/drop these files into the GitHub PR description. Filenames are intentionally stable and reviewer-friendly.',
    '',
    ...copied.flatMap((item) => [
      `## ${item.name}`,
      '',
      item.caption,
      '',
      `Source: \`${rel(outDir, item.source)}\``,
      '',
    ]),
  ].join('\n');
  fs.writeFileSync(path.join(imagesDir, 'README.md'), `${imageReadme}\n`);

  const genericPrDesc = [
    '# PR description draft',
    '',
    '## Description',
    '',
    '<!-- Replace with the human-readable product summary. -->',
    '',
    '## Related Jira',
    '',
    task ? `- ${task}` : '- <!-- Jira/task URL -->',
    '',
    '## Changes',
    '',
    '<!-- Summarize product files changed. Keep generated harness/task artifacts out of the PR diff. -->',
    '',
    '## Validation',
    '',
    verdict ? `Verdict: \`${verdict}\`` : 'Verdict: `TODO`',
    '',
    '<!-- Paste concise checks and recipe commands here. See evidence.md for full paths. -->',
    '',
    '## Evidence',
    '',
    '<!-- Drag/drop each image file at the markers below to let GitHub upload and render them. -->',
    '',
    buildImageSlots(copied),
    '## Artifact package',
    '',
    `Task path: \`${taskDir}\``,
    `PR package: \`${outDir}\``,
    fs.existsSync(evidenceSrc) ? '- Full evidence: `pr-package/evidence.md`' : '- Full evidence: missing `PR-READY-EVIDENCE.md` at package time',
    fs.existsSync(qualitySrc) ? '- Quality report: `pr-package/recipe-quality.md`' : '- Quality report: missing `artifacts/RECIPE-QUALITY.md` at package time',
    checklistExists ? '- Checklist: `pr-package/checklist.md`' : '- Checklist: missing `CHECKLIST.md` at package time',
    '',
    '## Notes / gaps',
    '',
    '<!-- Preserve pass-with-gaps details, runtime console noise, blocked states, or cleanup status. -->',
  ].join('\n');

  const prDesc = prTemplate
    ? buildTemplatePrDesc({
        templateText: readText(prTemplate.abs),
        templateRelPath: prTemplate.relPath,
        task,
        verdict,
        taskDir,
        outDir,
        copied,
        evidenceExists: fs.existsSync(evidenceSrc),
        qualityExists: fs.existsSync(qualitySrc),
        checklistExists,
      })
    : genericPrDesc;

  fs.writeFileSync(path.join(outDir, 'pr-desc.md'), `${prDesc}\n`);

  const manifest = {
    taskDir,
    outDir,
    task,
    branch,
    verdict,
    repoRoot,
    prTemplate: prTemplate ? prTemplate.relPath : null,
    files: {
      prDescription: path.join(outDir, 'pr-desc.md'),
      evidence: fs.existsSync(evidenceSrc) ? path.join(outDir, 'evidence.md') : null,
      quality: fs.existsSync(qualitySrc) ? path.join(outDir, 'recipe-quality.md') : null,
      checklist: fs.existsSync(checklistSrc) ? path.join(outDir, 'checklist.md') : null,
      images: copied.map((item) => ({ path: path.join(outDir, 'images', item.name), caption: item.caption, source: item.source })),
    },
    generatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(outDir, 'package-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

  const finalReport = [
    '# Final output report',
    '',
    `Task path: \`${taskDir}\``,
    `PR package path: \`${outDir}\``,
    `PR description draft: \`${path.join(outDir, 'pr-desc.md')}\``,
    `Evidence images folder: \`${imagesDir}\``,
    prTemplate ? `PR template source: \`${prTemplate.relPath}\`` : 'PR template source: not found; used generic fallback',
    '',
    copied.length ? 'Images:' : 'Images: none found',
    ...copied.map((item) => `- \`${path.join(outDir, 'images', item.name)}\` — ${item.caption}`),
  ].join('\n');
  fs.writeFileSync(path.join(outDir, 'final-report.md'), `${finalReport}\n`);

  console.log(finalReport);
}

try {
  main();
} catch (error) {
  console.error(error && error.stack ? error.stack : String(error));
  process.exit(1);
}
