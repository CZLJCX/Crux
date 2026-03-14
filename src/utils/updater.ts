import { existsSync, readFileSync, writeFileSync, cpSync, readdirSync, rmSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { spawn } from 'child_process';
import chalk from 'chalk';

const REPO_URL = 'https://github.com/CZLJCX/Crux.git';
const VERSION_URL = 'https://api.github.com/repos/CZLJCX/Crux/releases/latest';

export class Updater {
  private projectDir: string;
  private currentVersion: string;

  constructor() {
    this.projectDir = this.findProjectDir();
    this.currentVersion = this.getCurrentVersion();
  }

  private getCurrentVersion(): string {
    const pkgPath = join(this.projectDir, 'package.json');
    if (existsSync(pkgPath)) {
      try {
        return JSON.parse(readFileSync(pkgPath, 'utf-8')).version;
      } catch {
        return '0.0.0';
      }
    }
    return '0.0.0';
  }

  private findProjectDir(): string {
    const globalPath = join(homedir(), 'AppData', 'Roaming', 'npm', 'node_modules', 'crux');
    if (existsSync(globalPath)) {
      return join(homedir(), 'Crux');
    }
    
    const altGlobalPath = join(homedir(), '.npm-global', 'lib', 'node_modules', 'crux');
    if (existsSync(altGlobalPath)) {
      return join(dirname(altGlobalPath), '..', '..');
    }
    
    if (existsSync(join(process.cwd(), 'package.json'))) {
      return process.cwd();
    }
    
    return join(homedir(), 'Crux');
  }

  async checkForUpdate(): Promise<{ hasUpdate: boolean; latestVersion: string }> {
    console.log(chalk.cyan('\n  Checking for updates...\n'));

    try {
      const response = await fetch(VERSION_URL, {
        headers: { 'Accept': 'application/vnd.github.v3+json' }
      });

      if (!response.ok) {
        console.log(chalk.yellow(`  Unable to check for updates (HTTP ${response.status})\n`));
        return { hasUpdate: false, latestVersion: this.currentVersion };
      }

      const data = await response.json() as { tag_name?: string };
      const latestVersion = data.tag_name?.replace('v', '') || this.currentVersion;

      return {
        hasUpdate: latestVersion !== this.currentVersion,
        latestVersion
      };
    } catch (error) {
      console.log(chalk.yellow(`  Unable to check for updates: ${error}\n`));
      return { hasUpdate: false, latestVersion: this.currentVersion };
    }
  }

  async update(): Promise<void> {
    console.log(chalk.cyan(`
  ╭─────────────────────────────────
  │ ${chalk.white('Updating Crux')}
  ╰─────────────────────────────────
    `));

    console.log(chalk.gray(`  Current version: ${this.currentVersion}`));
    console.log(chalk.gray(`  Project directory: ${this.projectDir}\n`));

    const { hasUpdate, latestVersion } = await this.checkForUpdate();

    if (!hasUpdate) {
      if (latestVersion === this.currentVersion) {
        console.log(chalk.green('  ✓ You are using the latest version!\n'));
      }
      return;
    }

    console.log(chalk.yellow(`  New version available: ${latestVersion}\n`));

    const currentEnvPath = join(this.projectDir, '.env');
    const backupEnvPath = join(this.projectDir, '.env.backup');

    if (existsSync(currentEnvPath)) {
      console.log(chalk.gray('  Backing up .env file...'));
      cpSync(currentEnvPath, backupEnvPath);
      console.log(chalk.green('  ✓ .env backed up to .env.backup\n'));
    }

    console.log(chalk.gray('  Pulling latest code...'));
    await this.runCommand('git', ['pull', 'origin', 'main'], this.projectDir);

    console.log(chalk.gray('\n  Installing dependencies...'));
    await this.runCommand('npm', ['install'], this.projectDir);

    console.log(chalk.gray('\n  Building project...'));
    await this.runCommand('npm', ['run', 'build'], this.projectDir);

    console.log(chalk.gray('\n  Reinstalling globally...'));
    await this.runCommand('npm', ['install', '-g'], this.projectDir);

    if (existsSync(backupEnvPath) && !existsSync(currentEnvPath)) {
      console.log(chalk.gray('\n  Restoring .env file...'));
      cpSync(backupEnvPath, currentEnvPath);
      rmSync(backupEnvPath);
      console.log(chalk.green('  ✓ .env restored\n'));
    }

    console.log(chalk.green(`
  ╭─────────────────────────────────
  │ ${chalk.green('✓ Update completed!')}
  ╰─────────────────────────────────
    `));
  }

  private runCommand(command: string, args: string[], cwd: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const proc = spawn(command, args, {
        cwd,
        shell: true,
        stdio: 'inherit'
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Command failed with code ${code}`));
        }
      });

      proc.on('error', reject);
    });
  }
}