#!/usr/bin/env node

import { cpSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { stdin as input, stdout as output } from 'node:process';
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