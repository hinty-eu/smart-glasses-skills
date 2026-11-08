#!/usr/bin/env node
// Repository checks run in CI and before every commit:
//  - skill frontmatter (name matches folder, prefix, description with "Use when", body under 500 lines)
//  - plugin directory limits (file size, file count, no symlinks or binaries, portable file names)
//  - style (no em or en dashes in Markdown)
//  - no maintainer-specific URLs or token names in the content agents read
// Usage: node scripts/check-repo.mjs
import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { basename, dirname, extname } from 'node:path';

const errors = [];
const fail = (file, msg) => errors.push(`${file}: ${msg}`);

const tracked = execFileSync('git', ['ls-files', '-s', '--cached', '--others', '--exclude-standard'], { encoding: 'utf8' })
  .split('\n')
  .filter(Boolean)
  .map(line => {
    // "--others" lines have no mode; "-s" lines look like "100644 <sha> 0\tpath"
    const tab = line.indexOf('\t');
    return tab === -1 ? { mode: null, path: line } : { mode: line.slice(0, 6), path: line.slice(tab + 1) };
  });
const files = [...new Map(tracked.map(f => [f.path, f])).values()];

// 1. Plugin directory limits
const MAX_FILES = 512;
const MAX_TEXT_BYTES = 256 * 1024;
const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg']);
const BINARY_EXT = new Set(['.pdf', '.zip', '.jar', '.aar', '.apk', '.ipa', '.so', '.dylib', '.dll', '.exe', '.bin', '.ehpk', '.tgz', '.gz']);
const JUNK = new Set(['.DS_Store', 'Thumbs.db', 'desktop.ini']);
const RESERVED = /^(con|prn|aux|nul|com\d|lpt\d)(\..*)?$/i;

if (files.length > MAX_FILES) fail('(repo)', `${files.length} files, the plugin directory allows at most ${MAX_FILES}`);
for (const { mode, path } of files) {
  const name = basename(path);
  const ext = extname(name).toLowerCase();
  if (mode === '120000') fail(path, 'symlinks are not allowed');
  if (JUNK.has(name) || path.includes('__MACOSX')) fail(path, 'junk file');
  if (/[<>:"|?*\\]/.test(path) || /[. ]$/.test(name) || RESERVED.test(name)) fail(path, 'file name is not portable to Windows');
  if (BINARY_EXT.has(ext)) fail(path, 'binary files are not allowed, link to them instead');
  let size = 0;
  try { size = statSync(path).size; } catch { continue; }
  if (!IMAGE_EXT.has(ext) && size > MAX_TEXT_BYTES) fail(path, `${size} bytes, text files must stay under 256 KiB`);
}

// 2. Skill frontmatter
function frontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!m) return null;
  const data = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([a-zA-Z_-]+):\s*(.*)$/);
    if (kv) data[kv[1]] = kv[2].replace(/^["']|["']$/g, '');
  }
  return { data, body: m[2] };
}

const skills = files.map(f => f.path).filter(p => /^skills\/[^/]+\/SKILL\.md$/.test(p));
if (!skills.length) fail('skills/', 'no skills found');
for (const p of skills) {
  const folder = basename(dirname(p));
  const fm = frontmatter(readFileSync(p, 'utf8'));
  if (!fm) { fail(p, 'missing YAML frontmatter'); continue; }
  const { name, description } = fm.data;
  if (name !== folder) fail(p, `name "${name}" must match the folder "${folder}"`);
  if (!/^smart-glasses(-[a-z0-9]+)*$/.test(name || '')) fail(p, 'name must be lowercase, hyphenated and start with "smart-glasses"');
  if ((name || '').length > 64) fail(p, 'name longer than 64 characters');
  if (!description) fail(p, 'missing description');
  else {
    if (description.length > 1024) fail(p, `description is ${description.length} characters, the limit is 1024`);
    if (!/Use when/.test(description)) fail(p, 'description must say when to use the skill ("Use when ...")');
  }
  const lines = fm.body.split(/\r?\n/).length;
  if (lines >= 500) fail(p, `body is ${lines} lines, keep it under 500 and move detail to references/`);
}

// 3. Style and content rules
const textFiles = files.map(f => f.path).filter(p => /\.(md|mdx|json|ya?ml|txt|mjs|js|ts|kt|swift)$/i.test(p));
const AGENT_CONTENT = /^(skills|examples|data|evals)\//;
for (const p of textFiles) {
  let text;
  try { text = readFileSync(p, 'utf8'); } catch { continue; }
  if (/\.mdx?$/i.test(p) && /[–—]/.test(text)) fail(p, 'contains an en or em dash, use a plain hyphen "-"');
  if (/api\.v1\.hinty\.eu|hinty\.token/i.test(text)) fail(p, 'contains a maintainer API address or token name');
  // The repository's own address is fine; any other mention of the maintainer in agent-facing content is not.
  const withoutRepoUrl = text.replace(/hinty-eu\/smart-glasses-skills/gi, '');
  if (AGENT_CONTENT.test(p) && /hinty/i.test(withoutRepoUrl)) fail(p, 'skill, example, data and eval content must not mention the maintainer');
}

if (errors.length) {
  console.error(`check-repo: ${errors.length} problem(s)\n` + errors.map(e => `  - ${e}`).join('\n'));
  process.exit(1);
}
console.log(`check-repo: OK (${files.length} files, ${skills.length} skills)`);
