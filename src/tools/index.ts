import { toolRegistry } from '../core/ToolRegistry.js';
import { ShellTool, ShellToolDefinition } from './ShellTool.js';
import { FileTool, FileToolDefinition } from './FileTool.js';
import { GlobTool, GlobToolDefinition } from './GlobTool.js';
import { GrepTool, GrepToolDefinition } from './GrepTool.js';
import { WebFetchTool, WebFetchToolDefinition } from './WebFetchTool.js';

export function registerBuiltInTools() {
  toolRegistry.register(
    ShellToolDefinition.name,
    ShellToolDefinition.description,
    ShellToolDefinition.input_schema,
    ShellTool
  );

  toolRegistry.register(
    FileToolDefinition.name,
    FileToolDefinition.description,
    FileToolDefinition.input_schema,
    FileTool
  );

  toolRegistry.register(
    GlobToolDefinition.name,
    GlobToolDefinition.description,
    GlobToolDefinition.input_schema,
    GlobTool
  );

  toolRegistry.register(
    GrepToolDefinition.name,
    GrepToolDefinition.description,
    GrepToolDefinition.input_schema,
    GrepTool
  );

  toolRegistry.register(
    WebFetchToolDefinition.name,
    WebFetchToolDefinition.description,
    WebFetchToolDefinition.input_schema,
    WebFetchTool
  );
}

export { ShellTool, FileTool, GlobTool, GrepTool, WebFetchTool };

export const builtInTools = [
  ShellToolDefinition,
  FileToolDefinition,
  GlobToolDefinition,
  GrepToolDefinition,
  WebFetchToolDefinition,
];