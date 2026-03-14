import OpenAI from 'openai';
import { APIConfig, Message, LLMResponse, ToolCall, ReasoningCallback } from './types.js';
import { configManager } from './config.js';

export class LLMConnector {
  private client!: OpenAI;
  private config: APIConfig;

  constructor(config?: Partial<APIConfig>) {
    this.config = { ...configManager.get().api, ...config };
    this.recreateClient();
  }

  private recreateClient() {
    this.client = new OpenAI({
      apiKey: this.config.apiKey,
      baseURL: this.config.baseURL,
    });
  }

  async chat(messages: Message[]): Promise<LLMResponse> {
    const response = await this.client.chat.completions.create({
      model: this.config.model,
      messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
      max_tokens: this.config.maxTokens,
      temperature: this.config.temperature,
      stream: false,
    });

    const choice = response.choices[0];
    const content = choice.message.content || '';
    const reasoning = (choice.message as any).reasoning_content || '';
    const toolCalls = choice.message.tool_calls?.map(tc => ({
      id: tc.id,
      type: 'function' as const,
      function: {
        name: tc.function.name,
        arguments: tc.function.arguments,
      },
    }));

    return {
      content,
      reasoning,
      toolCalls,
      finishReason: choice.finish_reason as LLMResponse['finishReason'],
    };
  }

  async *streamChat(messages: Message[], onReasoning?: ReasoningCallback): AsyncGenerator<string> {
    const response = await this.client.chat.completions.create({
      model: this.config.model,
      messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
      max_tokens: this.config.maxTokens,
      temperature: this.config.temperature,
      stream: true,
    });

    let fullContent = '';
    let fullReasoning = '';
    let buffer = '';

    for await (const chunk of response) {
      const delta = chunk.choices[0]?.delta;
      const content = delta?.content || '';
      const reasoning = (delta as any)?.reasoning_content || '';

      if (reasoning) {
        fullReasoning += reasoning;
        if (onReasoning) {
          onReasoning(reasoning);
        }
      }

      if (content) {
        fullContent += content;
        buffer += content;

        if (buffer.includes('\n') || buffer.length > 10) {
          yield buffer;
          buffer = '';
        }
      }
    }

    if (buffer) {
      yield buffer;
    }
  }

  async chatWithTools(
    messages: Message[],
    tools: OpenAI.Chat.ChatCompletionTool[]
  ): Promise<LLMResponse> {
    const response = await this.client.chat.completions.create({
      model: this.config.model,
      messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
      tools,
      max_tokens: this.config.maxTokens,
      temperature: this.config.temperature,
      stream: false,
    });

    const choice = response.choices[0];
    const content = choice.message.content || '';
    const reasoning = (choice.message as any).reasoning_content || '';
    const toolCalls = choice.message.tool_calls?.map(tc => ({
      id: tc.id,
      type: 'function' as const,
      function: {
        name: tc.function.name,
        arguments: tc.function.arguments,
      },
    }));

    return {
      content,
      reasoning,
      toolCalls,
      finishReason: choice.finish_reason as LLMResponse['finishReason'],
    };
  }

  async *streamChatWithTools(
    messages: Message[],
    tools: OpenAI.Chat.ChatCompletionTool[],
    onToolCall?: (toolCall: ToolCall) => void,
    onReasoning?: ReasoningCallback
  ): AsyncGenerator<string> {
    const response = await this.client.chat.completions.create({
      model: this.config.model,
      messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
      tools,
      max_tokens: this.config.maxTokens,
      temperature: this.config.temperature,
      stream: true,
    });

    let buffer = '';
    let currentToolCall: Partial<ToolCall> | null = null;

    for await (const chunk of response) {
      const delta = chunk.choices[0]?.delta;
      const content = delta?.content || '';
      const toolCalls = delta?.tool_calls;
      const reasoning = (delta as any)?.reasoning_content || '';

      if (reasoning && onReasoning) {
        onReasoning(reasoning);
      }

      if (content) {
        buffer += content;
        if (buffer.includes('\n') || buffer.length > 20) {
          yield buffer;
          buffer = '';
        }
      }

      if (toolCalls && toolCalls.length > 0) {
        const tc = toolCalls[0];
        if (!currentToolCall) {
          currentToolCall = {
            id: tc.id || '',
            type: 'function',
            function: { name: tc.function?.name || '', arguments: tc.function?.arguments || '' },
          };
        } else if (tc.function?.arguments) {
          currentToolCall.function!.arguments += tc.function.arguments;
        }
      }
    }

    if (buffer) {
      yield buffer;
    }

    if (currentToolCall && currentToolCall.id && currentToolCall.function?.name && onToolCall) {
      const fullToolCall: ToolCall = {
        id: currentToolCall.id,
        type: 'function',
        function: {
          name: currentToolCall.function.name,
          arguments: currentToolCall.function.arguments,
        },
      };
      onToolCall(fullToolCall);
    }
  }

  setApiKey(apiKey: string): void {
    this.config.apiKey = apiKey;
    this.recreateClient();
  }

  setModel(model: string): void {
    this.config.model = model;
  }

  setBaseURL(baseURL: string): void {
    this.config.baseURL = baseURL;
    this.recreateClient();
  }

  setTemperature(temperature: number): void {
    this.config.temperature = temperature;
  }
}