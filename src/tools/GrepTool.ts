import { readFile } from 'fs/promises';
import { stat } from 'fs/promises';
import { ToolExecuteFunc } from '../core/types.js';

interface GrepResult {
  file: string;
  line: number;
  content: string;
}

export const GrepTool: ToolExecuteFunc = async (args) => {
  const { pattern, path = '.', include = '*', recursive = true, caseSensitive = true } = args;

  if (!pattern) {
    return JSON.stringify({ error: 'pattern is required' });
  }

  try {
    const fs = await import('fs');
    const { minimatch } = await import('minimatch');
    const pathModule = await import('path');

    const results: GrepResult[] = [];
    const regex = new RegExp(pattern as string, caseSensitive ? 'g' : 'gi');
    const maxResults = 100;
    const maxFileSize = 1024 * 1024;

    async function searchDir(dir: string): Promise<void> {
      if (results.length >= maxResults) return;

      let entries;
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        return;
      }

      for (const entry of entries) {
        if (results.length >= maxResults) break;

        const fullPath = pathModule.join(dir, entry.name);

        if (entry.isDirectory() && recursive) {
          if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
            await searchDir(fullPath);
          }
        } else if (entry.isFile()) {
          if (include && include !== '*') {
            const patterns = (include as string).split(',').map(p => p.trim());
            if (!patterns.some(p => minimatch(entry.name, p))) {
              continue;
            }
          }

          try {
            const stats = await stat(fullPath);
            if (stats.size > maxFileSize) continue;

            const content = await readFile(fullPath, 'utf-8');
            const lines = content.split('\n');

            for (let i = 0; i < lines.length && results.length < maxResults; i++) {
              if (regex.test(lines[i])) {
                results.push({
                  file: fullPath,
                  line: i + 1,
                  content: lines[i].substring(0, 200),
                });
              }
            }

            regex.lastIndex = 0;
          } catch {
            // Skip files we can't read
          }
        }
      }
    }

    await searchDir(path as string);

    return JSON.stringify({
      results: results.slice(0, maxResults),
      count: results.length,
      truncated: results.length >= maxResults,
      success: true,
    });
  } catch (error: any) {
    return JSON.stringify({ error: error.message, success: false });
  }
};

export const GrepToolDefinition = {
  name: 'grep',
  description: 'Search for text patterns in files',
  input_schema: {
    type: 'object',
    properties: {
      pattern: {
        type: 'string',
        description: 'Regular expression pattern to search for',
      },
      path: {
        type: 'string',
        description: 'Directory path to search in',
        default: '.',
      },
      include: {
        type: 'string',
        description: 'File patterns to include (e.g., "*.ts,*.js")',
        default: '*',
      },
      recursive: {
        type: 'boolean',
        description: 'Search recursively',
        default: true,
      },
      caseSensitive: {
        type: 'boolean',
        description: 'Case sensitive search',
        default: true,
      },
    },
    required: ['pattern'],
  },
};