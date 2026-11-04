/**
 * Dev supervisor — zero dependencies.
 *
 * Starts the API proxy and the Vite dev server in one terminal, prefixes their
 * output so interleaved logs stay readable, and tears both down on Ctrl+C.
 * `concurrently` would do the same thing behind ~40 transitive packages; this
 * is 60 lines we can read.
 */

import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

/** @type {import('node:child_process').ChildProcess[]} */
const children = [];
let shuttingDown = false;

/**
 * @param {string} name
 * @param {string[]} args
 * @param {string} color
 */
function run(name, args, color) {
  const child = spawn(process.execPath, args, {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, FORCE_COLOR: '1' },
  });

  children.push(child);

  const prefix = `\u001b[${color}m[${name}]\u001b[0m`;

  for (const stream of [child.stdout, child.stderr]) {
    let buffer = '';
    stream.setEncoding('utf8');
    stream.on('data', (chunk) => {
      buffer += chunk;
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (line.trim().length > 0) process.stdout.write(`${prefix} ${line}\n`);
      }
    });
  }

  child.on('exit', (code, signal) => {
    if (shuttingDown) return;
    process.stdout.write(`${prefix} exited (${signal ?? code})\n`);
    shutdown(code ?? 1);
  });

  return child;
}

/** @param {number} code */
function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (child.exitCode === null && !child.killed) child.kill();
  }
  // Give the children a tick to flush before the parent exits.
  setTimeout(() => process.exit(code), 150);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

run('api', [join(root, 'server', 'index.ts')], '35');
run('ui', [join(root, 'node_modules', 'vite', 'bin', 'vite.js'), '--port', '3000', '--host'], '36');
