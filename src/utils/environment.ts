import { existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { spawn, execSync } from 'child_process';
import chalk from 'chalk';

const isWindows = process.platform === 'win32';

export class EnvironmentManager {
  private projectDir: string;

  constructor() {
    this.projectDir = process.cwd();
  }

  private runCommand(command: string, args: string[], cwd: string, silent: boolean = false): Promise<boolean> {
    return new Promise((resolve) => {
      const proc = spawn(command, args, {
        cwd,
        shell: true,
        stdio: silent ? 'ignore' : 'inherit',
      });

      proc.on('close', (code) => {
        resolve(code === 0);
      });

      proc.on('error', () => {
        resolve(false);
      });
    });
  }

  private execCommand(command: string): string {
    try {
      return execSync(command, { encoding: 'utf-8', stdio: 'pipe' }).trim();
    } catch {
      return '';
    }
  }

  async checkRust(): Promise<{ installed: boolean; version: string }> {
    try {
      const version = this.execCommand('rustc --version');
      if (version) {
        return { installed: true, version };
      }
    } catch {}
    return { installed: false, version: '' };
  }

  async installRust(): Promise<boolean> {
    console.log(chalk.yellow('\n  Rust not found. Installing Rust...\n'));

    if (isWindows) {
      console.log(chalk.gray('  Please run the following command manually:'));
      console.log(chalk.cyan('  https://rustup.rs\n'));
      return false;
    }

    const success = await this.runCommand('curl', [
      '--proto',
      '=https',
      '--tlsv1.2',
      '-sSf',
      'https://sh.rustup.rs',
    ], this.projectDir);

    if (success) {
      console.log(chalk.green('\n  ✓ Rust installed successfully!\n'));
    } else {
      console.log(chalk.red('\n  ✗ Failed to install Rust\n'));
    }

    return success;
  }

  async checkAndInstallRust(): Promise<boolean> {
    const { installed, version } = await this.checkRust();

    if (installed) {
      console.log(chalk.green(`  ✓ Rust found: ${version}`));
      return true;
    }

    return await this.installRust();
  }

  async checkNodeModules(dir: string): Promise<boolean> {
    const nodeModules = join(dir, 'node_modules');
    return existsSync(nodeModules);
  }

  async installNodeDeps(dir: string, name: string): Promise<boolean> {
    console.log(chalk.yellow(`\n  Installing ${name} dependencies...`));

    const hasDeps = await this.checkNodeModules(dir);
    if (hasDeps) {
      console.log(chalk.green(`  ✓ ${name} dependencies already installed`));
      return true;
    }

    const success = await this.runCommand('npm', ['install'], dir);

    if (success) {
      console.log(chalk.green(`  ✓ ${name} dependencies installed successfully!\n`));
    } else {
      console.log(chalk.red(`  ✗ Failed to install ${name} dependencies\n`));
    }

    return success;
  }

  async prepareWeb(): Promise<boolean> {
    const webDir = join(this.projectDir, 'clients', 'web');
    return await this.installNodeDeps(webDir, 'Web');
  }

  async prepareGUI(): Promise<boolean> {
    const guiDir = join(this.projectDir, 'src', 'clients', 'gui');

    const depsOk = await this.installNodeDeps(guiDir, 'GUI');
    if (!depsOk) return false;

    return await this.checkAndInstallRust();
  }
}

export const envManager = new EnvironmentManager();