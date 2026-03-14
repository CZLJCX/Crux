#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '../..');

console.log('\x1b[1;35m启动 Crux Web\x1b[0m\n');

const server = spawn('npm', ['run', 'server'], {
  cwd: projectRoot,
  stdio: 'inherit',
  shell: process.platform === 'win32' ? 'cmd.exe' : true
});

setTimeout(() => {
  const web = spawn('npm', ['run', 'web'], {
    cwd: projectRoot,
    stdio: 'inherit',
    shell: process.platform === 'win32' ? 'cmd.exe' : true
  });
  
  web.on('exit', () => {
    server.kill();
    process.exit(0);
  });
}, 2000);

process.on('SIGINT', () => {
  server.kill();
  process.exit(0);
});