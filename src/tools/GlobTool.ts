import { glob } from 'glob';
import { ToolExecuteFunc } from '../core/types.js';

export const GlobTool: ToolExecuteFunc = async (args) => {
  const { pattern, cwd = process.cwd(), absolute = true } = args;

  if (!pattern) {
    return JSON.stringify({ error: 'pattern is required' });
  }

  try {
    const matches = await glob(pattern as string, {
      cwd: cwd as string,
      absolute: absolute as boolean,
      nodir: false,
    });

    return JSON.stringify({
      matches: matches.slice(0, 1000),
      count: matches.length,
      success: true,
    });
  } catch (error: any) {
    return JSON.stringify({ error: error.message, success: false });
  }
};

export const GlobToolDefinition = {
  name: 'glob',
  description: 'Find files matching a glob pattern',
  input_schema: {
    type: 'object',
    properties: {
      pattern: {
        type: 'string',
        description: 'Glob pattern (e.g., "**/*.ts", "src/**/*.js")',
      },
      cwd: {
        type: 'string',
        description: 'Current working directory',
      },
      absolute: {
        type: 'boolean',
        description: 'Return absolute paths',
        default: true,
      },
    },
    required: ['pattern'],
  },
};