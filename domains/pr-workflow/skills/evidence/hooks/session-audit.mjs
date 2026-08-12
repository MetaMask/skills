#!/usr/bin/env node
//
// Stop hook: say, at the end of a session, whether anything published without a gate.
//
// The corpus's own diagnostic for a rule that keeps being violated is "count repeats within
// a session — three fires means the rule is inert". Nothing was counting. The canonical file
// for the largest failure cluster failed to maintain its own recurrence count, which is the
// same class of failure it documents: a number that depends on someone remembering to
// increment it is not a measurement. A script does not forget.
//
// It reports UNGATED publishes — an outward-facing write with no gate invocation anywhere
// earlier in the session. That is the real signal and it is deterministic.
//
// It deliberately does NOT report "unchained" publishes, which skill-audit also emits. A
// publish is unchained when the gate is not part of the same shell command. Since the gate
// is wired as a PreToolUse hook it fires out-of-band on every write by construction, so it
// is never in the command, so every publish is unchained. Counting those produces a large
// number that measures the enforcement mechanism rather than any defect — which is exactly
// how an audit comes to report thousands of violations of a rule that is being enforced.
//
// Contract: reads Stop-hook JSON on stdin, writes a note to stderr, always exits 0. It is a
// report, not a gate; blocking the end of a session teaches nothing the note does not.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const AUDIT_CANDIDATES = [
  process.env.SKILL_AUDIT,
  `${process.env.HOME}/Code/metamask/skills/tools/skill-audit.mjs`,
  `${process.env.HOME}/.claude/skills/mms-evidence/hooks/skill-audit.mjs`,
].filter(Boolean);

let stdin = '';
process.stdin.setEncoding('utf8');
for await (const chunk of process.stdin) stdin += chunk;

let transcript;
try {
  transcript = JSON.parse(stdin || '{}').transcript_path;
} catch {
  process.exit(0);
}
if (!transcript || !existsSync(transcript)) process.exit(0);

const audit = AUDIT_CANDIDATES.find((p) => existsSync(p));
if (!audit) process.exit(0);

const proc = spawnSync(process.execPath, [audit, transcript, '--json'], {
  encoding: 'utf8',
  timeout: 30_000,
});
// skill-audit exits 1 when it FINDS something — the exit code is the verdict, not an
// error. Treating non-zero as failure made this hook bail on precisely the sessions it
// exists to report on, and report nothing on all the others, so it would have read as
// "clean" forever. Parse whatever it printed and let the payload decide.
if (!proc.stdout) process.exit(0);

let report;
try {
  report = JSON.parse(proc.stdout);
} catch {
  process.exit(0);
}

const ungated = report.ungatedPublishLines ?? [];
if (ungated.length === 0) process.exit(0);

process.stderr.write(
  `evidence audit: ${ungated.length} outward-facing publish(es) ran with no gate ` +
    `anywhere earlier in this session.\n` +
    `  transcript lines: ${ungated.slice(0, 12).join(', ')}` +
    `${ungated.length > 12 ? `, … +${ungated.length - 12} more` : ''}\n` +
    `  ${report.publishes} publish(es), ${report.gateRuns} gate run(s) total.\n`,
);
process.exit(0);
