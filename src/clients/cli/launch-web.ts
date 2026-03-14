#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '../..');

console.log('\x1b[1;35m启动 Crux Web\x1b[0m\n');

const server = spawn('npm', ['run', 'server'], {
  cwd: projectRoot,
  stdio: 'inherit',
  shell: true
});

const web = spawn('npm', ['run', 'web'], {
  cwd: projectRoot,
  stdio: 'inherit',
  shell: true
});

process.on('SIGINT', () => {
  server.kill();
  web.kill();
  process.exit(0);
});