import { readFile, writeFile, readdir, stat, mkdir, unlink, copyFile, rename } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname, basename } from 'path';
import { ToolExecuteFunc } from '../core/types.js';

export const FileTool: ToolExecuteFunc = async (args) => {
  const { action, path, content, dest, newName } = args;
  const actionName = action as string || 'read';

  try {
    switch (actionName) {
      case 'read': {
        if (!path) return JSON.stringify({ error: 'path is required' });
        const fileContent = await readFile(path as string, 'utf-8');
        return JSON.stringify({ content: fileContent.substring(0, 100000), success: true });
      }

      case 'write': {
        if (!path || content === undefined) return JSON.stringify({ error: 'path and content are required' });
        const dir = dirname(path as string);
        if (!existsSync(dir)) {
          await mkdir(dir, { recursive: true });
        }
        await writeFile(path as string, content as string, 'utf-8');
        return JSON.stringify({ success: true, path: path });
      }

      case 'list': {
        if (!path) return JSON.stringify({ error: 'path is required' });
        const items = await readdir(path as string);
        const itemsWithStats = await Promise.all(
          items.map(async (item) => {
            const fullPath = join(path as string, item);
            const stats = await stat(fullPath);
            return {
              name: item,
              isDirectory: stats.isDirectory(),
              isFile: stats.isFile(),
              size: stats.size,
              modified: stats.mtime.toISOString(),
            };
          })
        );
        return JSON.stringify({ items: itemsWithStats, success: true });
      }

      case 'mkdir': {
        if (!path) return JSON.stringify({ error: 'path is required' });
        await mkdir(path as string, { recursive: true });
        return JSON.stringify({ success: true, path: path });
      }

      case 'delete': {
        if (!path) return JSON.stringify({ error: 'path is required' });
        await unlink(path as string);
        return JSON.stringify({ success: true, path: path });
      }

      case 'copy': {
        if (!path || !dest) return JSON.stringify({ error: 'path and dest are required' });
        await copyFile(path as string, dest as string);
        return JSON.stringify({ success: true, from: path, to: dest });
      }

      case 'move': {
        if (!path || !dest) return JSON.stringify({ error: 'path and dest are required' });
        await rename(path as string, dest as string);
        return JSON.stringify({ success: true, from: path, to: dest });
      }

      case 'rename': {
        if (!path || !newName) return JSON.stringify({ error: 'path and newName are required' });
        const dir = dirname(path as string);
        const newPath = join(dir, newName as string);
        await rename(path as string, newPath);
        return JSON.stringify({ success: true, from: path, to: newPath });
      }

      case 'exists': {
        if (!path) return JSON.stringify({ error: 'path is required' });
        return JSON.stringify({ exists: existsSync(path as string), path: path });
      }

      case 'stat': {
        if (!path) return JSON.stringify({ error: 'path is required' });
        const stats = await stat(path as string);
        return JSON.stringify({
          success: true,
          isDirectory: stats.isDirectory(),
          isFile: stats.isFile(),
          size: stats.size,
          created: stats.birthtime.toISOString(),
          modified: stats.mtime.toISOString(),
        });
      }

      default:
        return JSON.stringify({ error: `Unknown action: ${actionName}` });
    }
  } catch (error: any) {
    return JSON.stringify({ error: error.message, success: false });
  }
};

export const FileToolDefinition = {
  name: 'file',
  description: 'Read, write, list, create, delete files and directories',
  input_schema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['read', 'write', 'list', 'mkdir', 'delete', 'copy', 'move', 'rename', 'exists', 'stat'],
        description: 'The action to perform',
      },
      path: {
        type: 'string',
        description: 'File or directory path',
      },
      content: {
        type: 'string',
        description: 'Content to write (for write action)',
      },
      dest: {
        type: 'string',
        description: 'Destination path (for copy, move)',
      },
      newName: {
        type: 'string',
        description: 'New name (for rename)',
      },
    },
    required: ['action', 'path'],
  },
};