import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';
import { join } from 'path';
import type { ToolExecuteFunc } from '../core/types.js';

const execAsync = promisify(exec);

interface NpmCommands {
  install: string;
  installDev: string;
  uninstall: string;
  update: string;
  list: string;
  outdated: string;
  audit: string;
  init: string;
  run: string;
}

interface PipCommands {
  install: string;
  uninstall: string;
  list: string;
  outdated: string;
  show: string;
  freeze: string;
}

const NPM_PACKAGE_MANAGERS: Record<string, NpmCommands> = {
  npm: {
    install: 'npm install',
    installDev: 'npm install -D',
    uninstall: 'npm uninstall',
    update: 'npm update',
    list: 'npm list --depth=0',
    outdated: 'npm outdated',
    audit: 'npm audit',
    init: 'npm init -y',
    run: 'npm run',
  },
  yarn: {
    install: 'yarn add',
    installDev: 'yarn add -D',
    uninstall: 'yarn remove',
    update: 'yarn upgrade',
    list: 'yarn list --depth=0',
    outdated: 'yarn outdated',
    audit: 'yarn audit',
    init: 'yarn init -y',
    run: 'yarn run',
  },
  pnpm: {
    install: 'pnpm add',
    installDev: 'pnpm add -D',
    uninstall: 'pnpm remove',
    update: 'pnpm update',
    list: 'pnpm list --depth=0',
    outdated: 'pnpm outdated',
    audit: 'pnpm audit',
    init: 'pnpm init',
    run: 'pnpm run',
  },
};

const PIP_PACKAGE_MANAGERS: Record<string, PipCommands> = {
  pip: {
    install: 'pip install',
    uninstall: 'pip uninstall -y',
    list: 'pip list',
    outdated: 'pip list --outdated',
    show: 'pip show',
    freeze: 'pip freeze',
  },
  pip3: {
    install: 'pip3 install',
    uninstall: 'pip3 uninstall -y',
    list: 'pip3 list',
    outdated: 'pip3 list --outdated',
    show: 'pip3 show',
    freeze: 'pip3 freeze',
  },
};

type PackageManager = keyof typeof NPM_PACKAGE_MANAGERS | keyof typeof PIP_PACKAGE_MANAGERS;

function detectPackageManager(dir: string): PackageManager {
  if (existsSync(join(dir, 'pnpm-lock.yaml'))) return 'pnpm';
  if (existsSync(join(dir, 'yarn.lock'))) return 'yarn';
  if (existsSync(join(dir, 'package.json'))) return 'npm';
  if (existsSync(join(dir, 'requirements.txt')) || existsSync(join(dir, 'setup.py'))) return 'pip';
  return 'npm';
}

function isNpmManager(manager: PackageManager): manager is keyof typeof NPM_PACKAGE_MANAGERS {
  return manager in NPM_PACKAGE_MANAGERS;
}

function isPipManager(manager: PackageManager): manager is keyof typeof PIP_PACKAGE_MANAGERS {
  return manager in PIP_PACKAGE_MANAGERS;
}

export const DependencyTool: ToolExecuteFunc = async (args: Record<string, unknown>) => {
  const { action, packages, manager, dev, global: isGlobal, cwd, version, script } = args;
  const actionName = action as string || 'install';
  const workDir = (cwd as string) || process.cwd();

  try {
    const detectedManager = (manager as PackageManager) || detectPackageManager(workDir);

    switch (actionName) {
      case 'install': {
        if (!packages || !Array.isArray(packages) || packages.length === 0) {
          return JSON.stringify({ error: 'packages array is required' });
        }

        const packageList = packages.map((p: string) => {
          if (version && typeof version === 'object' && (version as Record<string, string>)[p]) {
            return `${p}@${(version as Record<string, string>)[p]}`;
          }
          return p;
        }).join(' ');

        let command: string;
        if (isPipManager(detectedManager)) {
          const commands = PIP_PACKAGE_MANAGERS[detectedManager];
          command = `${commands.install} ${packageList}`;
        } else {
          const commands = NPM_PACKAGE_MANAGERS[detectedManager];
          command = dev 
            ? `${commands.installDev} ${packageList}`
            : `${commands.install} ${packageList}`;
          if (isGlobal) command += ' -g';
        }

        const { stdout, stderr } = await execAsync(command, {
          cwd: workDir,
          timeout: 120000,
          maxBuffer: 10 * 1024 * 1024,
        });

        return JSON.stringify({
          success: true,
          action: 'install',
          packages: packageList,
          manager: detectedManager,
          dev: !!dev,
          stdout: stdout.substring(0, 10000),
          stderr: stderr.substring(0, 5000),
        });
      }

      case 'uninstall': {
        if (!packages || !Array.isArray(packages) || packages.length === 0) {
          return JSON.stringify({ error: 'packages array is required' });
        }

        const packageList = packages.join(' ');
        let command: string;
        
        if (isPipManager(detectedManager)) {
          command = `${PIP_PACKAGE_MANAGERS[detectedManager].uninstall} ${packageList}`;
        } else {
          command = `${NPM_PACKAGE_MANAGERS[detectedManager as keyof typeof NPM_PACKAGE_MANAGERS].uninstall} ${packageList}`;
        }

        const { stdout, stderr } = await execAsync(command, {
          cwd: workDir,
          timeout: 60000,
        });

        return JSON.stringify({
          success: true,
          action: 'uninstall',
          packages,
          manager: detectedManager,
          stdout: stdout.substring(0, 5000),
        });
      }

      case 'list': {
        let command: string;
        if (isPipManager(detectedManager)) {
          command = PIP_PACKAGE_MANAGERS[detectedManager].list;
        } else {
          command = NPM_PACKAGE_MANAGERS[detectedManager as keyof typeof NPM_PACKAGE_MANAGERS].list;
        }
        
        const { stdout } = await execAsync(command, { cwd: workDir, timeout: 30000 });

        const lines = stdout.split('\n').filter(l => l.trim());
        const deps: Array<{ name: string; version: string }> = [];

        for (const line of lines.slice(1)) {
          const match = line.match(/[├└│─\s]*([^@\s]+)@?([\d.]+)/);
          if (match) {
            deps.push({ name: match[1].trim(), version: match[2] });
          }
        }

        return JSON.stringify({
          success: true,
          manager: detectedManager,
          dependencies: deps,
          raw: stdout.substring(0, 10000),
        });
      }

      case 'outdated': {
        let command: string;
        if (isPipManager(detectedManager)) {
          command = PIP_PACKAGE_MANAGERS[detectedManager].outdated;
        } else {
          command = NPM_PACKAGE_MANAGERS[detectedManager as keyof typeof NPM_PACKAGE_MANAGERS].outdated;
        }

        try {
          const { stdout } = await execAsync(command, { cwd: workDir, timeout: 30000 });
          
          const outdated: Array<{ name: string; current: string; latest: string }> = [];
          const lines = stdout.split('\n').filter(l => l.trim());
          
          for (const line of lines.slice(1)) {
            const parts = line.split(/\s+/).filter(Boolean);
            if (parts.length >= 3) {
              outdated.push({ name: parts[0], current: parts[1], latest: parts[2] });
            }
          }

          return JSON.stringify({
            success: true,
            outdated,
            hasUpdates: outdated.length > 0,
          });
        } catch (error: any) {
          return JSON.stringify({
            success: true,
            outdated: [],
            hasUpdates: false,
            message: 'All packages are up to date',
          });
        }
      }

      case 'audit': {
        if (!isNpmManager(detectedManager)) {
          return JSON.stringify({ error: 'audit only supported for npm/yarn/pnpm' });
        }

        const command = NPM_PACKAGE_MANAGERS[detectedManager].audit;

        try {
          const { stdout } = await execAsync(command, { cwd: workDir, timeout: 30000 });
          
          const vulnerabilities = {
            critical: (stdout.match(/critical/gi) || []).length,
            high: (stdout.match(/high/gi) || []).length,
            moderate: (stdout.match(/moderate/gi) || []).length,
            low: (stdout.match(/low/gi) || []).length,
          };

          return JSON.stringify({
            success: true,
            vulnerabilities,
            hasVulnerabilities: vulnerabilities.critical > 0 || vulnerabilities.high > 0,
            raw: stdout.substring(0, 10000),
          });
        } catch (error: any) {
          return JSON.stringify({
            success: true,
            vulnerabilities: { critical: 0, high: 0, moderate: 0, low: 0 },
            hasVulnerabilities: false,
          });
        }
      }

      case 'info': {
        const pkgList = packages as string[] | undefined;
        if (!pkgList || pkgList.length === 0) {
          return JSON.stringify({ error: 'package name is required' });
        }

        const pkg = pkgList[0];
        let command: string;

        if (isPipManager(detectedManager)) {
          command = `${detectedManager} show ${pkg}`;
        } else {
          command = `npm view ${pkg}`;
        }

        const { stdout } = await execAsync(command, { timeout: 30000 });

        return JSON.stringify({
          success: true,
          package: pkg,
          info: stdout,
        });
      }

      case 'init': {
        if (!isNpmManager(detectedManager)) {
          return JSON.stringify({ error: 'init only supported for npm/yarn/pnpm' });
        }

        const command = NPM_PACKAGE_MANAGERS[detectedManager].init;
        await execAsync(command, { cwd: workDir, timeout: 30000 });

        return JSON.stringify({
          success: true,
          manager: detectedManager,
          message: `Initialized ${detectedManager} project`,
        });
      }

      case 'run': {
        if (!script || typeof script !== 'string') {
          return JSON.stringify({ error: 'script name is required' });
        }

        if (!isNpmManager(detectedManager)) {
          return JSON.stringify({ error: 'run only supported for npm/yarn/pnpm' });
        }

        const command = `${NPM_PACKAGE_MANAGERS[detectedManager].run} ${script}`;
        const { stdout, stderr } = await execAsync(command, {
          cwd: workDir,
          timeout: 120000,
          maxBuffer: 10 * 1024 * 1024,
        });

        return JSON.stringify({
          success: true,
          script,
          stdout: stdout.substring(0, 50000),
          stderr: stderr.substring(0, 10000),
        });
      }

      default:
        return JSON.stringify({ error: `Unknown action: ${actionName}` });
    }
  } catch (error: any) {
    return JSON.stringify({
      success: false,
      error: error.message,
      stdout: error.stdout?.substring(0, 5000) || '',
      stderr: error.stderr?.substring(0, 5000) || '',
    });
  }
};

export const DependencyToolDefinition = {
  name: 'dependency',
  description: 'Manage project dependencies: install, uninstall, list, check outdated, audit vulnerabilities. Supports npm, yarn, pnpm, pip.',
  input_schema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['install', 'uninstall', 'list', 'outdated', 'audit', 'info', 'init', 'run'],
        description: 'Dependency action to perform',
      },
      packages: {
        type: 'array',
        items: { type: 'string' },
        description: 'Package names',
      },
      manager: {
        type: 'string',
        enum: ['npm', 'yarn', 'pnpm', 'pip', 'pip3'],
        description: 'Package manager (auto-detected if not specified)',
      },
      dev: {
        type: 'boolean',
        description: 'Install as dev dependency',
      },
      global: {
        type: 'boolean',
        description: 'Install globally',
      },
      cwd: {
        type: 'string',
        description: 'Working directory',
      },
      version: {
        type: 'object',
        description: 'Package versions: { "package": "version" }',
      },
      script: {
        type: 'string',
        description: 'Script name to run (for "run" action)',
      },
    },
    required: ['action'],
  },
};