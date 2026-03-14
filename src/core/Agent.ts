import { Message, ToolCall, ToolResult, StreamCallback, ReasoningCallback } from './types.js';
import { LLMConnector } from './LLMConnector.js';
import { toolRegistry } from './ToolRegistry.js';
import { sessionManager } from './SessionManager.js';
import { configManager } from './config.js';

export interface ChatOptions {
  streamCallback?: StreamCallback;
  reasoningCallback?: ReasoningCallback;
}

export class Agent {
  private llm: LLMConnector;
  private systemPrompt: string;

  constructor(systemPrompt?: string) {
    this.llm = new LLMConnector();
    this.systemPrompt = systemPrompt || this.getDefaultSystemPrompt();
  }

  private getDefaultSystemPrompt(): string {
    return `You are Crux, an AI agent that can execute commands, read/write files, and search the web.
You have access to the following tools:
- shell: Execute shell commands
- file: Read, write, list, create, delete files and directories
- glob: Find files matching a glob pattern
- grep: Search for text patterns in files
- web_fetch: Fetch content from a URL

Always provide clear explanations before taking actions. When you need to use tools, use them appropriately.`;
  }

  setSystemPrompt(prompt: string): void {
    this.systemPrompt = prompt;
  }

  async chat(
    messages: Message[],
    streamCallback?: StreamCallback,
    reasoningCallback?: ReasoningCallback
  ): Promise<{ content: string; reasoning?: string; toolCalls?: ToolCall[]; toolResults?: ToolResult[] }> {
    const tools = toolRegistry.getOpenAITools();
    let allToolResults: ToolResult[] = [];
    let allToolCalls: ToolCall[] = [];
    let fullReasoning = '';

    if (streamCallback || reasoningCallback) {
      let currentMessages = [...messages];
      let loopCount = 0;
      const maxLoops = 10;

      while (loopCount < maxLoops) {
        loopCount++;
        let fullContent = '';

        for await (const chunk of this.llm.streamChatWithTools(currentMessages, tools, () => {}, (reasoning) => {
          if (reasoningCallback) {
            fullReasoning += reasoning;
            reasoningCallback(reasoning);
          }
        })) {
          fullContent += chunk;
          if (streamCallback) {
            streamCallback(chunk, false);
          }
        }

        const response = await this.llm.chatWithTools(currentMessages, tools);
        
        if (response.reasoning && reasoningCallback) {
          fullReasoning += response.reasoning;
          reasoningCallback(response.reasoning);
        }
        
        if (response.toolCalls && response.toolCalls.length > 0) {
          allToolCalls.push(...response.toolCalls);

          for (const tc of response.toolCalls) {
            if (streamCallback) {
              streamCallback(`\n[Thinking] ${tc.function.name}\n`, false);
            }
            
            try {
              const args = JSON.parse(tc.function.arguments);
              const result = await toolRegistry.execute(tc.function.name, args);
              allToolResults.push({
                tool_call_id: tc.id,
                output: result,
              });
              if (streamCallback) {
                streamCallback(`\n[Result] ${result.substring(0, 300)}...\n`, true);
              }
            } catch (error: any) {
              const errorResult = JSON.stringify({ error: error.message });
              allToolResults.push({
                tool_call_id: tc.id,
                output: errorResult,
                is_error: true,
              });
              if (streamCallback) {
                streamCallback(`\n[Error] ${error.message}\n`, true);
              }
            }
          }

          const toolMessages: Message[] = allToolResults.map(tr => ({
            role: 'tool' as const,
            content: tr.output,
            tool_call_id: tr.tool_call_id,
          }));

          currentMessages = [
            ...messages,
            { role: 'assistant' as const, content: fullContent, tool_calls: response.toolCalls },
            ...toolMessages
          ];
        } else {
          return { content: fullContent, reasoning: fullReasoning, toolCalls: allToolCalls, toolResults: allToolResults };
        }
      }

      return { content: '', reasoning: fullReasoning, toolCalls: allToolCalls, toolResults: allToolResults };
    }

    let currentMessages = [...messages];
    let loopCount = 0;
    const maxLoops = 10;

    while (loopCount < maxLoops) {
      loopCount++;
      const response = await this.llm.chatWithTools(currentMessages, tools);
      
      if (response.reasoning) {
        fullReasoning = response.reasoning;
      }
      
      if (response.toolCalls && response.toolCalls.length > 0) {
        allToolCalls.push(...response.toolCalls);
        const toolResults: ToolResult[] = [];

        for (const tc of response.toolCalls) {
          try {
            const args = JSON.parse(tc.function.arguments);
            const result = await toolRegistry.execute(tc.function.name, args);
            toolResults.push({
              tool_call_id: tc.id,
              output: result,
            });
          } catch (error: any) {
            toolResults.push({
              tool_call_id: tc.id,
              output: JSON.stringify({ error: error.message }),
              is_error: true,
            });
          }
        }

        allToolResults.push(...toolResults);

        const toolMessages: Message[] = toolResults.map(tr => ({
          role: 'tool' as const,
          content: tr.output,
          tool_call_id: tr.tool_call_id,
        }));

        currentMessages = [
          ...messages,
          { role: 'assistant' as const, content: response.content, tool_calls: response.toolCalls },
          ...toolMessages
        ];
      } else {
        return { content: response.content, reasoning: fullReasoning, toolCalls: allToolCalls, toolResults: allToolResults };
      }
    }

    return { content: '', reasoning: fullReasoning, toolCalls: allToolCalls, toolResults: allToolResults };
  }

  async *streamChatIter(
    messages: Message[]
  ): AsyncGenerator<{ type: 'content' | 'reasoning' | 'tool_call' | 'tool_result' | 'done'; data: string }> {
    const tools = toolRegistry.getOpenAITools();
    let toolCallBuffer = '';
    let pendingReasoning = '';

    for await (const chunk of this.llm.streamChatWithTools(messages, tools, (tc) => {
      toolCallBuffer = JSON.stringify(tc);
    }, (reasoning) => {
      pendingReasoning += reasoning;
    })) {
      if (pendingReasoning) {
        yield { type: 'reasoning', data: pendingReasoning };
        pendingReasoning = '';
      }
      yield { type: 'content', data: chunk };
    }

    if (pendingReasoning) {
      yield { type: 'reasoning', data: pendingReasoning };
      pendingReasoning = '';
    }

    if (toolCallBuffer) {
      yield { type: 'tool_call', data: toolCallBuffer };
      
      const tc = JSON.parse(toolCallBuffer);
      const args = JSON.parse(tc.function.arguments);
      
      try {
        const result = await toolRegistry.execute(tc.function.name, args);
        yield { type: 'tool_result', data: result };
      } catch (error: any) {
        yield { type: 'tool_result', data: JSON.stringify({ error: error.message }) };
      }
    }

    yield { type: 'done', data: '' };
  }

  setApiKey(apiKey: string): void {
    this.llm.setApiKey(apiKey);
  }

  setModel(model: string): void {
    this.llm.setModel(model);
  }

  setBaseURL(baseURL: string): void {
    this.llm.setBaseURL(baseURL);
  }

  setTemperature(temperature: number): void {
    this.llm.setTemperature(temperature);
  }

  listTools(): string[] {
    return toolRegistry.list();
  }
}