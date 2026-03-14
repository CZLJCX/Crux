#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const guiDir = join(__dirname, '../../src/clients/gui');

const proc = spawn('npm', ['run', 'tauri', 'dev'], {
  cwd: guiDir,
  stdio: 'inherit',
  shell: true
});

proc.on('exit', (code) => {
  process.exit(code ?? 0);
});