import { exec } from 'child_process';
import { promisify } from 'util';
import type { ToolExecuteFunc } from '../core/types.js';

const execAsync = promisify(exec);

export const ShellTool: ToolExecuteFunc = async (args: Record<string, unknown>) => {
  const { command, timeout = 30000 } = args;

  if (!command || typeof command !== 'string') {
    return JSON.stringify({ error: 'Command is required' });
  }

  try {
    const { stdout, stderr } = await execAsync(command, {
      timeout: timeout as number,
      maxBuffer: 10 * 1024 * 1024,
      encoding: 'utf-8',
    });

    return JSON.stringify({
      stdout: stdout.substring(0, 50000),
      stderr: stderr.substring(0, 10000),
      success: true,
    });
  } catch (error: any) {
    return JSON.stringify({
      stdout: error.stdout?.substring(0, 50000) || '',
      stderr: error.stderr?.substring(0, 10000) || error.message,
      success: false,
      code: error.code,
    });
  }
};

export const ShellToolDefinition = {
  name: 'shell',
  description: 'Execute a shell command on the local system. Returns stdout and stderr.',
  input_schema: {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description: 'The shell command to execute',
      },
      timeout: {
        type: 'number',
        description: 'Timeout in milliseconds (default: 30000)',
        default: 30000,
      },
    },
    required: ['command'],
  },
};