import { toolRegistry } from '../core/ToolRegistry.js';
import { ShellTool, ShellToolDefinition } from './ShellTool.js';
import { FileTool, FileToolDefinition } from './FileTool.js';
import { GlobTool, GlobToolDefinition } from './GlobTool.js';
import { GrepTool, GrepToolDefinition } from './GrepTool.js';
import { WebFetchTool, WebFetchToolDefinition } from './WebFetchTool.js';
import { TimeTool, TimeToolDefinition } from './TimeTool.js';
import { CalculatorTool, CalculatorToolDefinition } from './CalculatorTool.js';
import { JsonTool, JsonToolDefinition } from './JsonTool.js';
import { CodeRunnerTool, CodeRunnerToolDefinition } from './CodeRunnerTool.js';
import { DependencyTool, DependencyToolDefinition } from './DependencyTool.js';
import { CodeAnalysisTool, CodeAnalysisToolDefinition } from './CodeAnalysisTool.js';
import { ScaffoldTool, ScaffoldToolDefinition } from './ScaffoldTool.js';

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

  toolRegistry.register(
    TimeToolDefinition.name,
    TimeToolDefinition.description,
    TimeToolDefinition.input_schema,
    TimeTool
  );

  toolRegistry.register(
    CalculatorToolDefinition.name,
    CalculatorToolDefinition.description,
    CalculatorToolDefinition.input_schema,
    CalculatorTool
  );

  toolRegistry.register(
    JsonToolDefinition.name,
    JsonToolDefinition.description,
    JsonToolDefinition.input_schema,
    JsonTool
  );

  toolRegistry.register(
    CodeRunnerToolDefinition.name,
    CodeRunnerToolDefinition.description,
    CodeRunnerToolDefinition.input_schema,
    CodeRunnerTool
  );

  toolRegistry.register(
    DependencyToolDefinition.name,
    DependencyToolDefinition.description,
    DependencyToolDefinition.input_schema,
    DependencyTool
  );

  toolRegistry.register(
    CodeAnalysisToolDefinition.name,
    CodeAnalysisToolDefinition.description,
    CodeAnalysisToolDefinition.input_schema,
    CodeAnalysisTool
  );

  toolRegistry.register(
    ScaffoldToolDefinition.name,
    ScaffoldToolDefinition.description,
    ScaffoldToolDefinition.input_schema,
    ScaffoldTool
  );
}

export { ShellTool, FileTool, GlobTool, GrepTool, WebFetchTool, TimeTool, CalculatorTool, JsonTool, CodeRunnerTool, DependencyTool, CodeAnalysisTool, ScaffoldTool };

export const builtInTools = [
  ShellToolDefinition,
  FileToolDefinition,
  GlobToolDefinition,
  GrepToolDefinition,
  WebFetchToolDefinition,
  TimeToolDefinition,
  CalculatorToolDefinition,
  JsonToolDefinition,
  CodeRunnerToolDefinition,
  DependencyToolDefinition,
  CodeAnalysisToolDefinition,
  ScaffoldToolDefinition,
];