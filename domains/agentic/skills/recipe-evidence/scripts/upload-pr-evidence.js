#!/usr/bin/env node
// upload-pr-evidence.js — push packaged PR evidence images to the CURRENT GitHub
// user's public artifacts repo and create/edit the PR with hosted image URLs.
//
// The artifacts owner is ALWAYS the logged-in `gh` user (never hard-coded), and
// every outward action is explicit-flag gated so the calling skill can ask the
// human first:
//   --ensure-repo            create <owner>/mm-<adapter>-artifacts (public) if missing
//   --confirm-public-upload  REQUIRED to upload screenshots to the public repo (alias --upload)
//   --create-pr              create the PR if none exists for the branch (else edit it)
// Use --dry-run to print the plan (owner/repo/branch/URLs) without any writes.
//
// The owner is ALWAYS the logged-in gh user — there is no owner override, so
// uploads/public-repo creation cannot be retargeted at another account/org.
//
// Usage:
//   upload-pr-evidence.js --task <task-dir> [--adapter extension|mobile]
//     [--ensure-repo] [--confirm-public-upload] [--create-pr] [--pr <number>] [--title <pr title>] [--dry-run]
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

function usage() {
  console.error(
    'Usage: upload-pr-evidence.js --task <task-dir> [--adapter extension|mobile] [--ensure-repo] [--confirm-public-upload] [--create-pr] [--pr <n>] [--title <t>] [--dry-run]',
  );
}

function parseArgs(argv) {
  const a = { task: '', adapter: '', ensureRepo: false, createPr: false, upload: false, pr: '', title: '', dryRun: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--task') a.task = argv[++i] || '';
    else if (arg === '--adapter') a.adapter = argv[++i] || '';
    else if (arg === '--pr') a.pr = argv[++i] || '';
    else if (arg === '--title') a.title = argv[++i] || '';
    else if (arg === '--ensure-repo') a.ensureRepo = true;
    else if (arg === '--create-pr') a.createPr = true;
    else if (arg === '--confirm-public-upload' || arg === '--upload') a.upload = true;
    else if (arg === '--dry-run') a.dryRun = true;
    else if (arg === '-h' || arg === '--help') { usage(); process.exit(0); }
    else throw new Error(`Unknown arg: ${arg}`);
  }
  if (!a.task) { usage(); throw new Error('--task is required'); }
  return a;
}

// gh with GH_TOKEN stripped: the fine-grained PAT in GH_TOKEN lacks write scope,
// so writes must fall back to the keyring token. Reads work either way.
function gh(args, { input } = {}) {
  const env = { ...process.env };
  delete env.GH_TOKEN;
  return execFileSync('gh', args, { encoding: 'utf8', env, input, maxBuffer: 64 * 1024 * 1024 }).trim();
}

function git(args, cwd) {
  return execFileSync('git', args, { encoding: 'utf8', cwd }).trim();
}

function detectProductRepo(taskDir) {
  // Prefer the product checkout (cwd), fall back to the task dir's repo.
  for (const cwd of [process.cwd(), taskDir]) {
    try {
      const url = git(['remote', 'get-url', 'origin'], cwd);
      const m = /[:/]([^/]+\/[^/]+?)(?:\.git)?$/u.exec(url);
      if (m) return { slug: m[1], cwd };
    } catch { /* keep trying */ }
  }
  throw new Error('Could not detect the product GitHub repo from origin remote.');
}

function adapterFromSlug(slug) {
  if (/metamask-extension$/u.test(slug)) return 'extension';
  if (/metamask-mobile$/u.test(slug)) return 'mobile';
  return '';
}

// Percent-encode each path segment so branch names with `/` (kept as separators)
// or spaces/special chars don't break the GitHub contents URL or the raw URL.
function encodePathSegments(p) {
  return String(p)
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

function listImages(prPackage) {
  const dir = path.join(prPackage, 'images');
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((n) => /\.(png|jpe?g|gif|webp)$/iu.test(n))
    .sort()
    .map((n) => ({ name: n, abs: path.join(dir, n) }));
}

function ghRepoExists(ownerRepo) {
  try { gh(['repo', 'view', ownerRepo, '--json', 'name']); return true; } catch { return false; }
}

function defaultBranch(ownerRepo) {
  try { return gh(['repo', 'view', ownerRepo, '--json', 'defaultBranchRef', '--jq', '.defaultBranchRef.name']) || 'main'; }
  catch { return 'main'; }
}

function existingSha(ownerRepo, repoPath) {
  try { return gh(['api', `repos/${ownerRepo}/contents/${repoPath}`, '--jq', '.sha']); }
  catch { return ''; }
}

function uploadImage(ownerRepo, repoPath, abs, branch, dryRun) {
  if (dryRun) return;
  const content = fs.readFileSync(abs).toString('base64');
  const sha = existingSha(ownerRepo, repoPath);
  const body = JSON.stringify({
    message: `evidence: ${repoPath}`,
    content,
    branch,
    ...(sha ? { sha } : {}),
  });
  gh(['api', '-X', 'PUT', `repos/${ownerRepo}/contents/${repoPath}`, '--input', '-'], { input: body });
}

// Replace (or append) the Screenshots/Recordings section of a PR body.
function injectScreenshots(body, block) {
  const heading = /^#{1,3}\s*\*{0,2}Screenshots(?:\/Recordings)?\*{0,2}\s*$/imu;
  if (heading.test(body)) {
    const lines = body.split('\n');
    const out = [];
    let i = 0;
    while (i < lines.length) {
      out.push(lines[i]);
      if (heading.test(lines[i])) {
        out.push('', block, '');
        i += 1;
        while (i < lines.length && !/^#{1,3}\s/u.test(lines[i])) i += 1; // drop old section body
        continue;
      }
      i += 1;
    }
    return out.join('\n');
  }
  return `${body.trim()}\n\n## Screenshots/Recordings\n\n${block}\n`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const taskDir = path.resolve(args.task);
  const prPackage = fs.existsSync(path.join(taskDir, 'pr-package')) ? path.join(taskDir, 'pr-package') : taskDir;

  const { slug, cwd } = detectProductRepo(taskDir);
  const adapter = args.adapter || adapterFromSlug(slug);
  if (adapter !== 'extension' && adapter !== 'mobile') {
    throw new Error(`Unsupported product repo for evidence upload: ${slug} (expected metamask-extension or metamask-mobile).`);
  }
  // Owner is always the logged-in gh user — never overridable — so uploads and
  // public-repo creation cannot be retargeted at another account/org.
  const owner = gh(['api', 'user', '--jq', '.login']);
  if (!owner) throw new Error('Could not resolve the logged-in GitHub user (gh api user). Run `gh auth login` first.');
  const artifactsRepo = `${owner}/mm-${adapter}-artifacts`;
  const branch = git(['rev-parse', '--abbrev-ref', 'HEAD'], cwd);
  const images = listImages(prPackage);

  const plan = {
    productRepo: slug,
    adapter,
    owner,
    artifactsRepo,
    branch,
    images: images.map((x) => x.name),
    evidencePath: `evidence/${branch}/`,
  };
  console.error(`[upload] plan: ${JSON.stringify(plan, null, 2)}`);

  if (!images.length) console.error('[upload] WARN: no images under pr-package/images — only the PR text will be updated.');

  // Upload consent gate: never push screenshots to the PUBLIC artifacts repo
  // without an explicit per-run flag, even when the repo already exists (so a
  // re-run can't silently re-upload). --ensure-repo only gates first-time repo
  // creation; this gates the upload itself.
  if (images.length && !args.dryRun && !args.upload) {
    throw new Error(`Refusing to upload ${images.length} screenshot(s) to the PUBLIC repo ${artifactsRepo} without explicit consent. Re-run with --confirm-public-upload after confirming with the user (public repo; screenshots may show wallet state — addresses/balances/positions). Use --dry-run to preview without uploading.`);
  }

  // 1. ensure artifacts repo
  const repoExists = ghRepoExists(artifactsRepo);
  if (!repoExists) {
    // dry-run previews without writes and never requires repo-creation consent.
    if (!args.ensureRepo && !args.dryRun) {
      throw new Error(`Artifacts repo ${artifactsRepo} does not exist. Re-run with --ensure-repo ONLY after the user gives informed consent: this creates a PUBLIC GitHub repo and uploads the evidence screenshots there, and those screenshots may show wallet state (addresses, balances, positions). Anyone can view a public repo.`);
    }
    if (args.dryRun) {
      console.error(`[upload] dry-run: artifacts repo ${artifactsRepo} does not exist${args.ensureRepo ? ' (would be created with --ensure-repo)' : ' (creating it needs --ensure-repo)'} — no writes.`);
    } else {
      console.error(`[upload] creating PUBLIC artifacts repo ${artifactsRepo} (screenshots may show wallet state — addresses/balances/positions — and are world-readable)`);
      gh(['repo', 'create', artifactsRepo, '--public', '--description', `MetaMask ${adapter} farm validation artifacts`]);
    }
  }

  // 2. upload images
  // The upload is gated above by --confirm-public-upload: it never runs without
  // that explicit per-run flag (or --dry-run, which writes nothing), even when the
  // artifacts repo already exists. The recipe-evidence skill also requires human
  // consent before invoking this script. Do not remove the gate.
  const branchDefault = repoExists || !args.dryRun ? defaultBranch(artifactsRepo) : 'main';
  const urls = [];
  const encodedBranch = encodePathSegments(branch);
  const encodedDefaultBranch = encodeURIComponent(branchDefault);
  for (const img of images) {
    const repoPath = `evidence/${encodedBranch}/${encodeURIComponent(img.name)}`;
    uploadImage(artifactsRepo, repoPath, img.abs, branchDefault, args.dryRun);
    urls.push({ name: img.name, url: `https://raw.githubusercontent.com/${artifactsRepo}/${encodedDefaultBranch}/${repoPath}` });
  }

  // 3. build the Screenshots block (images hosted; videos stay local drag/drop)
  const block = urls.length
    ? urls
        .map((u) => {
          // Escape Markdown link-text metacharacters so an odd artifact filename
          // can't corrupt the PR body (e.g. `[`/`]`/`\` in the alt text).
          const alt = u.name.replace(/\.[a-z0-9]+$/iu, '').replace(/([\\[\]])/gu, '\\$1');
          return `![${alt}](${u.url})`;
        })
        .join('\n\n')
    : '_No hosted screenshots; attach any local recordings by drag-and-drop._';

  // 4. PR body from pr-desc.md (fallback to a minimal body)
  const prDescPath = path.join(prPackage, 'pr-desc.md');
  let body = fs.existsSync(prDescPath) ? fs.readFileSync(prDescPath, 'utf8') : `## Summary\n\nSee evidence.\n`;
  body = injectScreenshots(body, block);
  const bodyFile = path.join(prPackage, 'pr-body.uploaded.md');
  if (!args.dryRun) fs.writeFileSync(bodyFile, body);

  // 5. create or edit the PR (only when --create-pr)
  let prRef = args.pr;
  if (!prRef) {
    try { prRef = gh(['pr', 'view', '--json', 'number', '--jq', '.number']); } catch { prRef = ''; }
  }
  let prUrl = '';
  if (args.createPr) {
    if (prRef) {
      console.error(`[upload] editing PR #${prRef}`);
      if (!args.dryRun) gh(['pr', 'edit', String(prRef), '--body-file', bodyFile]);
      if (!args.dryRun) prUrl = gh(['pr', 'view', String(prRef), '--json', 'url', '--jq', '.url']);
    } else {
      const title = args.title || git(['log', '-1', '--pretty=%s'], cwd);
      console.error(`[upload] creating PR "${title}"`);
      if (!args.dryRun) prUrl = gh(['pr', 'create', '--title', title, '--body-file', bodyFile]);
    }
  } else {
    console.error('[upload] --create-pr not set: uploaded assets + wrote pr-body.uploaded.md; PR not created/edited.');
  }

  console.log(JSON.stringify({ ...plan, defaultBranch: branchDefault, urls, prBodyFile: args.dryRun ? null : bodyFile, prUrl: prUrl || null, dryRun: args.dryRun }, null, 2));
}

try { main(); } catch (error) {
  console.error(`[upload] FAILED: ${error && error.message ? error.message : error}`);
  process.exit(1);
}
