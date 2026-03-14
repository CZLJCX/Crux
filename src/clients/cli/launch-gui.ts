#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '../../..');
const guiDir = join(projectRoot, 'src/clients/gui');

console.log('\x1b[1;35m启动 Crux GUI\x1b[0m\n');
console.log('工作目录:', guiDir);

const proc = spawn('npm', ['run', 'tauri', 'dev'], {
  cwd: guiDir,
  stdio: 'inherit',
  shell: process.platform === 'win32' ? 'cmd.exe' : true
});

proc.on('exit', (code) => {
  process.exit(code ?? 0);
});