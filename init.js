#!/usr/bin/env node

import { cpSync, existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { stdin as input, stdout as output, chdir } from 'node:process';
import { homedir } from 'os';
import { join } from 'path';
import readline from 'node:readline';

const rl = readline.createInterface({ input, output });

function question(query) {
  return new Promise((resolve) => rl.question(query, resolve));
}

function log(message) {
  console.log(`\x1b[36m❯\x1b[0m ${message}`);
}

function success(message) {
  console.log(`\x1b[32m✓\x1b[0m ${message}`);
}

function error(message) {
  console.log(`\x1b[31m✗\x1b[0m ${message}`);
}

function info(message) {
  console.log(`\x1b[33mℹ\x1b[0m ${message}`);
}

function shouldMoveToUserDir() {
  const cwd = process.cwd();
  const userHome = homedir();
  
  if (cwd.startsWith(userHome)) {
    return false;
  }
  
  const protectedPaths = [
    'C:\\Windows',
    'C:\\Program Files',
    'C:\\Program Files (x86)',
    '/usr',
    '/opt',
    '/System',
  ];
  
  return protectedPaths.some(p => cwd.startsWith(p));
}

function getUserDirCrux() {
  return join(homedir(), 'Crux');
}

function ensureProjectDir() {
  const cwd = process.cwd();
  const userDir = getUserDirCrux();
  
  if (existsSync(join(cwd, 'package.json'))) {
    return;
  }
  
  if (existsSync(join(userDir, 'package.json'))) {
    chdir(userDir);
    console.log(`已切换到项目目录: ${userDir}\n`);
    return;
  }
  
  console.log(`\n未找到 Crux 项目，请先克隆项目:\n`);
  console.log(`  git clone https://github.com/CZLJCX/Crux.git`);
  console.log(`  cd Crux`);
  console.log(`  npm run init\n`);
  process.exit(1);
}

async function moveToUserDir() {
  const userDir = getUserDirCrux();
  const userHome = homedir();
  
  log('检测到系统保护目录，正在移动到用户目录...\n');
  
  if (!existsSync(userDir)) {
    log('从 GitHub 克隆项目到用户目录...');
    const result = spawnSync('git', ['clone', 'https://github.com/CZLJCX/Crux.git', userDir], {
      shell: true,
      stdio: 'inherit',
    });
    if (result.status !== 0) {
      error('克隆失败');
      process.exit(1);
    }
    success('克隆完成');
  } else {
    info('用户目录已存在 Crux 项目');
    if (!existsSync(join(userDir, 'package.json'))) {
      error('用户目录项目不完整，请手动删除后重试');
      process.exit(1);
    }
  }
  
  chdir(userDir);
  console.log(`\n已切换到: ${userDir}\n`);
}

async function checkNodeVersion() {
  const version = process.version.slice(1).split('.').map(Number);
  const [major] = version;
  if (major < 18) {
    error(`Node.js 版本过低: ${process.version}，需要 ≥18.0.0`);
    process.exit(1);
  }
  success(`Node.js 版本检查通过: ${process.version}`);
}

async function copyEnvFile() {
  const examplePath = '.env.example';
  const envPath = '.env';

  if (!existsSync(examplePath)) {
    error('未找到 .env.example 文件');
    return false;
  }

  if (existsSync(envPath)) {
    const answer = await question('已存在 .env 文件，是否覆盖？[y/N]: ');
    if (answer.toLowerCase() !== 'y') {
      info('跳过配置生成');
      return false;
    }
  }

  cpSync(examplePath, envPath);
  success('已复制 .env.example → .env');
  return true;
}

async function updateEnvFile(apiKey, baseUrl, model, temperature) {
  const envPath = '.env';
  if (!existsSync(envPath)) return;

  let content = readFileSync(envPath, 'utf-8');
  content = content.replace(/^OPENAI_API_KEY=.*/m, `OPENAI_API_KEY=${apiKey}`);
  content = content.replace(/^OPENAI_BASE_URL=.*/m, `OPENAI_BASE_URL=${baseUrl}`);
  content = content.replace(/^OPENAI_MODEL=.*/m, `OPENAI_MODEL=${model}`);
  content = content.replace(/^OPENAI_TEMPERATURE=.*/m, `OPENAI_TEMPERATURE=${temperature}`);
  writeFileSync(envPath, content);
  success('已更新 .env 配置');
}

async function runCommand(command, args, description, cwd = null) {
  log(`执行: ${description}...`);
  const options = { shell: true, stdio: 'inherit' };
  if (cwd) {
    options.cwd = cwd;
  }
  const result = spawnSync(command, args, options);
  if (result.status !== 0) {
    error(`${description} 失败`);
    process.exit(1);
  }
  success(`${description} 完成`);
}

async function main() {
  ensureProjectDir();

  console.log('\n\x1b[1;35mCrux 初始化向导\x1b[0m\n');
  console.log('='.repeat(40));

  await checkNodeVersion();

  const generated = await copyEnvFile();

  if (generated || !existsSync('.env')) {
    console.log('\n\x1b[1m请配置 OpenAI API 信息\x1b[0m\n');

    const apiKey = await question('OPENAI_API_KEY (必填): ');
    if (!apiKey.trim()) {
      error('API Key 不能为空');
      process.exit(1);
    }

    const baseUrl = await question(`OPENAI_BASE_URL [${'https://api.openai.com/v1'}]: `) || 'https://api.openai.com/v1';
    const model = await question(`OPENAI_MODEL [${'gpt-4o'}]: `) || 'gpt-4o';
    const temperature = await question(`OPENAI_TEMPERATURE [${'0.7'}]: `) || '0.7';

    await updateEnvFile(apiKey, baseUrl, model, temperature);
  } else {
    info('使用已有的 .env 配置');
  }

  rl.close();

  console.log('\n' + '='.repeat(40));
  log('开始安装依赖...\n');

  await runCommand('npm', ['install'], '安装依赖');

  console.log('\n' + '='.repeat(40));
  log('开始编译项目...\n');

  await runCommand('npm', ['run', 'build'], '编译项目');

  console.log('\n' + '='.repeat(40));
  log('开始全局安装...\n');

  await runCommand('npm', ['install', '-g'], '全局安装');

  console.log('\n' + '='.repeat(40));
  log('开始安装 GUI 依赖...\n');

  await runCommand('npm', ['install'], '安装 GUI 依赖', 'src/clients/gui');

  console.log('\n' + '='.repeat(40));
  log('开始安装 Web 依赖...\n');

  await runCommand('npm', ['install'], '安装 Web 依赖', 'clients/web');

  console.log('\n' + '='.repeat(40));
  console.log('\n\x1b[32m初始化完成！\x1b[0m\n');
  console.log('运行以下命令启动:');
  console.log('  \x1b[36mcrux\x1b[0m');
  console.log('');
}

main().catch((err) => {
  error(err.message);
  process.exit(1);
});