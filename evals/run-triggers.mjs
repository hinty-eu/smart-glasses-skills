#!/usr/bin/env node
// Trigger check for the skills in this repository.
// Sends each query from evals/triggers.json to a fresh `claude -p` session that loads this repository as a plugin,
// in an empty temporary directory, and records the first skill Claude invokes.
//
// Usage (from the repository root):
//   node evals/run-triggers.mjs [--model sonnet] [--runs 1] [--only t01,n03] [--json evals/results/triggers.json]
//
// Needs the `claude` CLI on PATH and a signed-in account or ANTHROPIC_API_KEY. Each query is one short session
// (at most 2 turns, only the Skill tool pre-approved), so a full pass is 40 small runs per --runs.
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const pluginDir = resolve(here, '..');
const argv = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? fallback : argv[i + 1];
};
const model = opt('model', 'sonnet');
const runs = Math.max(1, Number(opt('runs', '1')));
const only = opt('only', '') ? new Set(opt('only', '').split(',')) : null;
const jsonOut = opt('json', '');

const suite = JSON.parse(readFileSync(join(here, 'triggers.json'), 'utf8'));
const ours = new Set(suite.skills);
const cases = suite.cases.filter(c => !only || only.has(c.id));

// The first Skill tool call in a stream-json transcript, without the "plugin-name:" prefix.
function firstSkill(stdout) {
  for (const line of stdout.split('\n')) {
    let msg;
    try { msg = JSON.parse(line); } catch { continue; }
    if (msg.type !== 'assistant') continue;
    for (const part of msg.message?.content ?? []) {
      if (part.type === 'tool_use' && part.name === 'Skill') return String(part.input?.skill ?? '').split(':').pop();
    }
  }
  return null;
}

const quote = a => (process.platform === 'win32' && /\s/.test(a) ? `"${a}"` : a);

function runOnce(query) {
  const cwd = mkdtempSync(join(tmpdir(), 'sg-trigger-'));
  try {
    const flags = ['-p', '--output-format', 'stream-json', '--verbose', '--max-turns', '2', '--model', model,
      '--plugin-dir', pluginDir, '--allowedTools', 'Skill', '--no-session-persistence'].map(quote);
    const r = spawnSync('claude', flags, {
      cwd, input: query, encoding: 'utf8', timeout: 180_000, maxBuffer: 64 * 1024 * 1024,
      shell: process.platform === 'win32', // claude is a .cmd shim on Windows
    });
    if (r.error) throw r.error;
    return firstSkill(r.stdout ?? '');
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

function verdict(c, fired) {
  if (!c.should_trigger) return fired && ours.has(fired) ? 'false-positive' : 'ok';
  if (!fired) return 'miss';
  if (fired === c.expected_skill || (c.also_ok ?? []).includes(fired)) return 'ok';
  return ours.has(fired) ? 'wrong-skill' : 'other-skill';
}

const rows = [];
for (const c of cases) {
  const results = [];
  for (let i = 0; i < runs; i++) {
    const fired = runOnce(c.query);
    results.push({ fired, verdict: verdict(c, fired) });
  }
  const passed = results.filter(r => r.verdict === 'ok').length;
  const row = { id: c.id, should_trigger: c.should_trigger, expected: c.expected_skill ?? null, passed, runs, results };
  rows.push(row);
  console.log(`${c.id}  ${passed}/${runs}  ${results.map(r => `${r.verdict}:${r.fired ?? '-'}`).join(' ')}  ${c.query}`);
}

const pos = rows.filter(r => r.should_trigger);
const neg = rows.filter(r => !r.should_trigger);
const rate = (list) => (list.length ? (100 * list.reduce((s, r) => s + r.passed / r.runs, 0)) / list.length : 0);
const summary = {
  model, runs, date: new Date().toISOString().slice(0, 10),
  should_trigger_hit_percent: Number(rate(pos).toFixed(1)),
  should_not_trigger_clean_percent: Number(rate(neg).toFixed(1)),
  overall_percent: Number(rate(rows).toFixed(1)),
};
console.log(JSON.stringify(summary, null, 2));
if (jsonOut) {
  mkdirSync(dirname(resolve(jsonOut)), { recursive: true });
  writeFileSync(jsonOut, JSON.stringify({ summary, rows }, null, 2));
}
