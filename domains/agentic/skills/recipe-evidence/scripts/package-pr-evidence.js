#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

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
  try { return fs.readFileSync(file, 'utf8'); } catch { return ''; }
}

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
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
  const outDir = path.resolve(args.out || path.join(taskDir, 'pr-package'));
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
  if (fs.existsSync(checklistSrc)) fs.copyFileSync(checklistSrc, path.join(outDir, 'checklist.md'));

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

  const imageSlots = copied.length
    ? copied.map((item, i) => [
        `### ${i + 1}. ${item.caption}`,
        '',
        `<!-- IMAGE_SLOT_${String(i + 1).padStart(2, '0')}: drag/drop \`pr-package/images/${item.name}\` below this line in GitHub, then keep the generated uploaded image markdown here. -->`,
        '',
        `Local file: \`pr-package/images/${item.name}\``,
        '',
      ].join('\n')).join('\n')
    : '<!-- No screenshot files were found under artifacts/**/screenshots. Add visual evidence before claiming visual ACs. -->\n';

  const prDesc = [
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
    imageSlots,
    '## Artifact package',
    '',
    `Task path: \`${taskDir}\``,
    `PR package: \`${outDir}\``,
    fs.existsSync(evidenceSrc) ? '- Full evidence: `pr-package/evidence.md`' : '- Full evidence: missing `PR-READY-EVIDENCE.md` at package time',
    fs.existsSync(qualitySrc) ? '- Quality report: `pr-package/recipe-quality.md`' : '- Quality report: missing `artifacts/RECIPE-QUALITY.md` at package time',
    '',
    '## Notes / gaps',
    '',
    '<!-- Preserve pass-with-gaps details, runtime console noise, blocked states, or cleanup status. -->',
  ].join('\n');
  fs.writeFileSync(path.join(outDir, 'pr-desc.md'), `${prDesc}\n`);

  const manifest = {
    taskDir,
    outDir,
    task,
    branch,
    verdict,
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
