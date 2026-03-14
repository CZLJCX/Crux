import type { ChatCompletionTool } from 'openai/resources/index.js';
import { ToolDefinition, ToolExecuteFunc } from './types.js';

export class ToolRegistry {
  private tools: Map<string, ToolExecuteFunc> = new Map();
  private definitions: Map<string, ToolDefinition> = new Map();

  register(name: string, description: string, inputSchema: Record<string, unknown>, func: ToolExecuteFunc): void {
    this.tools.set(name, func);
    this.definitions.set(name, {
      name,
      description,
      input_schema: inputSchema,
    });
  }

  get(name: string): ToolExecuteFunc | undefined {
    return this.tools.get(name);
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  getDefinition(name: string): ToolDefinition | undefined {
    return this.definitions.get(name);
  }

  getAllDefinitions(): ToolDefinition[] {
    return Array.from(this.definitions.values());
  }

  getOpenAITools(): ChatCompletionTool[] {
    return Array.from(this.definitions.values()).map(def => ({
      type: 'function' as const,
      function: {
        name: def.name,
        description: def.description,
        parameters: def.input_schema as any,
      },
    }));
  }

  async execute(name: string, args: Record<string, unknown>): Promise<string> {
    const func = this.tools.get(name);
    if (!func) {
      throw new Error(`Tool ${name} not found`);
    }
    return func(args);
  }

  list(): string[] {
    return Array.from(this.tools.keys());
  }
}

export const toolRegistry = new ToolRegistry();