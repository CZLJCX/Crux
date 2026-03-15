import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, unlink, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import type { ToolExecuteFunc } from '../core/types.js';

const execAsync = promisify(exec);

const LANGUAGE_CONFIG: Record<string, { extension: string; command: string; args: string[] }> = {
  javascript: { extension: '.js', command: 'node', args: [] },
  typescript: { extension: '.ts', command: 'npx', args: ['ts-node'] },
  python: { extension: '.py', command: 'python', args: ['-c'] },
  python3: { extension: '.py', command: 'python3', args: ['-c'] },
  bash: { extension: '.sh', command: 'bash', args: [] },
  shell: { extension: '.sh', command: 'bash', args: [] },
  powershell: { extension: '.ps1', command: 'powershell', args: ['-File'] },
};

export const CodeRunnerTool: ToolExecuteFunc = async (args: Record<string, unknown>) => {
  const { action, language, code, timeout = 30000, inputFile, input } = args;
  const actionName = action as string || 'run';

  try {
    switch (actionName) {
      case 'run': {
        if (!code || typeof code !== 'string') {
          return JSON.stringify({ error: 'code is required' });
        }

        const lang = (language as string || 'javascript').toLowerCase();
        const config = LANGUAGE_CONFIG[lang];

        if (!config) {
          return JSON.stringify({ 
            error: `Unsupported language: ${lang}`,
            supportedLanguages: Object.keys(LANGUAGE_CONFIG)
          });
        }

        const tempDir = join(tmpdir(), 'crux-code-runner');
        if (!existsSync(tempDir)) {
          await mkdir(tempDir, { recursive: true });
        }

        const fileName = `code_${Date.now()}${config.extension}`;
        const filePath = join(tempDir, fileName);

        await writeFile(filePath, code, 'utf-8');

        const command = config.args.length > 0
          ? `${config.command} ${config.args.join(' ')} "${filePath}"`
          : `${config.command} "${filePath}"`;

        try {
          const { stdout, stderr } = await execAsync(command, {
            timeout: timeout as number,
            maxBuffer: 10 * 1024 * 1024,
            cwd: tempDir,
          });

          return JSON.stringify({
            success: true,
            language: lang,
            stdout: stdout.substring(0, 50000),
            stderr: stderr.substring(0, 10000),
            executionTime: Date.now(),
          });
        } finally {
          try {
            await unlink(filePath);
          } catch {}
        }
      }

      case 'run_inline': {
        if (!code || typeof code !== 'string') {
          return JSON.stringify({ error: 'code is required' });
        }

        const lang = (language as string || 'javascript').toLowerCase();
        const config = LANGUAGE_CONFIG[lang];

        if (!config) {
          return JSON.stringify({ error: `Unsupported language: ${lang}` });
        }

        let command: string;
        if (lang === 'javascript') {
          command = `node -e "${code.replace(/"/g, '\\"')}"`;
        } else if (lang === 'python' || lang === 'python3') {
          command = `${config.command} "${code.replace(/"/g, '\\"')}"`;
        } else {
          return JSON.stringify({ error: 'Inline execution only supports JavaScript and Python' });
        }

        const { stdout, stderr } = await execAsync(command, {
          timeout: timeout as number,
          maxBuffer: 10 * 1024 * 1024,
        });

        return JSON.stringify({
          success: true,
          language: lang,
          stdout: stdout.substring(0, 50000),
          stderr: stderr.substring(0, 10000),
        });
      }

      case 'check': {
        const results: Record<string, boolean> = {};
        
        for (const [lang, config] of Object.entries(LANGUAGE_CONFIG)) {
          try {
            await execAsync(`${config.command} --version`, { timeout: 5000 });
            results[lang] = true;
          } catch {
            results[lang] = false;
          }
        }

        return JSON.stringify({
          success: true,
          availableRuntimes: results,
        });
      }

      default:
        return JSON.stringify({ error: `Unknown action: ${actionName}` });
    }
  } catch (error: any) {
    const isTimeout = error.killed === true || error.code === 'ETIMEDOUT';
    
    return JSON.stringify({
      success: false,
      error: isTimeout ? 'Execution timeout' : error.message,
      stdout: error.stdout?.substring(0, 10000) || '',
      stderr: error.stderr?.substring(0, 10000) || '',
      code: error.code,
    });
  }
};

export const CodeRunnerToolDefinition = {
  name: 'code_runner',
  description: 'Execute JavaScript, TypeScript, Python, Bash code and get results. Supports inline execution and file-based execution with timeout control.',
  input_schema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['run', 'run_inline', 'check'],
        description: 'Action to perform: run (execute from file), run_inline (execute inline string), check (check available runtimes)',
      },
      language: {
        type: 'string',
        enum: ['javascript', 'typescript', 'python', 'python3', 'bash', 'shell', 'powershell'],
        description: 'Programming language to execute',
      },
      code: {
        type: 'string',
        description: 'Code to execute',
      },
      timeout: {
        type: 'number',
        description: 'Execution timeout in milliseconds (default: 30000, max: 120000)',
      },
    },
    required: ['action'],
  },
};