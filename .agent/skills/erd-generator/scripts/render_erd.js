#!/usr/bin/env node
/**
 * render_erd.js
 *
 * Validates a Mermaid ERD and compiles it to an SVG using @mermaid-js/mermaid-cli (mmdc).
 *
 * Usage (from the repo root):
 *   node .agent/skills/erd-generator/scripts/render_erd.js docs/architecture/schema.mmd
 *
 * Success: writes docs/architecture/erd.svg, prints "SUCCESS", exits 0.
 * Failure: prints "SYNTAX_ERROR: <trace>", exits 1.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
// .agent/skills/erd-generator/scripts -> repo root
const repoRoot = path.resolve(scriptDir, '..', '..', '..', '..');

const inputArg = process.argv[2] ?? 'docs/architecture/schema.mmd';
const input = path.isAbsolute(inputArg) ? inputArg : path.resolve(repoRoot, inputArg);
const output = path.resolve(repoRoot, 'docs/architecture/erd.svg');

function fail(trace) {
  console.log(`SYNTAX_ERROR: ${String(trace).trim()}`);
  process.exit(1);
}

if (!fs.existsSync(input)) {
  fail(`Input file not found: ${input}`);
}

// Ensure the output folder exists and remove any stale SVG so an old file can never mask a failure.
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.rmSync(output, { force: true });

const result = spawnSync(
  'npx',
  ['--no-install', 'mmdc', '-i', input, '-o', output, '--quiet'],
  { cwd: repoRoot, encoding: 'utf8' }
);

if (result.error) {
  fail(`Could not run mmdc: ${result.error.message}`);
}

if (result.status !== 0) {
  fail(result.stderr || result.stdout || `mmdc exited with code ${result.status}`);
}

// mmdc can occasionally exit 0 without producing output; treat that as a failure too.
if (!fs.existsSync(output) || fs.statSync(output).size === 0) {
  fail(`mmdc reported success but ${output} was not created.\n${result.stderr || ''}`);
}

console.log('SUCCESS');
process.exit(0);
