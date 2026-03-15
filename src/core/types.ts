export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ToolResult {
  tool_call_id: string;
  output: string;
  is_error?: boolean;
}

export interface FileAttachment {
  name: string;
  type: string;
  content: string;
  size: number;
}

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  reasoning?: string;
  tool_call_id?: string;
  name?: string;
  tool_calls?: ToolCall[];
  files?: FileAttachment[];
}

export interface Session {
  id: string;
  name: string;
  created_at: number;
  updated_at: number;
  messages: Message[];
  model?: string;
}

export interface SessionSummary {
  id: string;
  name: string;
  created_at: number;
  updated_at: number;
  message_count: number;
  preview: string;
}

export interface APIConfig {
  apiKey: string;
  baseURL: string;
  model: string;
  maxTokens: number;
  temperature: number;
  stream: boolean;
}

export interface AppConfig {
  dataDir: string;
  sessionDir: string;
  configFile: string;
  api: APIConfig;
}

export interface LLMResponse {
  content: string;
  reasoning?: string;
  toolCalls?: ToolCall[];
  finishReason: 'stop' | 'length' | 'tool_calls' | null;
}

export type StreamCallback = (chunk: string, isToolCall: boolean) => void;
export type ReasoningCallback = (reasoning: string) => void;
export type ToolExecuteFunc = (args: Record<string, unknown>) => Promise<string>;