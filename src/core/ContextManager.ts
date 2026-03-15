import { Message } from './types.js';

interface ContextConfig {
  maxTokens: number;
  reservedTokens: number;
  summarizationThreshold: number;
  minPreserveMessages: number;
  maxPreserveMessages: number;
}

const DEFAULT_CONFIG: ContextConfig = {
  maxTokens: 128000,
  reservedTokens: 8000,
  summarizationThreshold: 0.7,
  minPreserveMessages: 4,
  maxPreserveMessages: 30,
};

export class ContextManager {
  private config: ContextConfig;
  private summaryCache: Map<string, string> = new Map();

  constructor(config?: Partial<ContextConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  estimateTokens(text: string): number {
    if (!text) return 0;
    const charCount = text.length;
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    
    return Math.ceil(
      chineseChars * 1.5 +
      (charCount - chineseChars) * 0.25 +
      wordCount * 0.5
    );
  }

  estimateMessagesTokens(messages: Message[]): number {
    return messages.reduce((total, msg) => {
      let msgTokens = this.estimateTokens(msg.content || '');
      if (msg.reasoning) {
        msgTokens += this.estimateTokens(msg.reasoning);
      }
      if (msg.tool_calls) {
        msgTokens += this.estimateTokens(JSON.stringify(msg.tool_calls));
      }
      if (msg.files) {
        for (const file of msg.files) {
          msgTokens += this.estimateTokens(file.name);
        }
      }
      return total + msgTokens + 4;
    }, 0);
  }

  getStats(messages: Message[]): {
    totalTokens: number;
    messageCount: number;
    utilizationPercent: number;
    needsCompression: boolean;
  } {
    const totalTokens = this.estimateMessagesTokens(messages);
    return {
      totalTokens,
      messageCount: messages.length,
      utilizationPercent: Math.round((totalTokens / this.config.maxTokens) * 100),
      needsCompression: totalTokens > this.config.maxTokens * this.config.summarizationThreshold,
    };
  }

  private calculateDynamicWindowSize(totalTokens: number): number {
    const utilization = totalTokens / this.config.maxTokens;
    
    if (utilization < 0.3) {
      return this.config.maxPreserveMessages;
    } else if (utilization < 0.5) {
      return 20;
    } else if (utilization < 0.7) {
      return 12;
    } else if (utilization < 0.85) {
      return 8;
    } else {
      return this.config.minPreserveMessages;
    }
  }

  compressForLLM(messages: Message[]): Message[] {
    if (messages.length === 0) {
      return messages;
    }

    const totalTokens = this.estimateMessagesTokens(messages);
    const threshold = this.config.maxTokens * this.config.summarizationThreshold;

    if (totalTokens <= threshold) {
      return messages;
    }

    const windowSize = this.calculateDynamicWindowSize(totalTokens);
    const recentMessages = messages.slice(-windowSize);
    const olderMessages = messages.slice(0, -windowSize);

    if (olderMessages.length === 0) {
      return this.trimToFit(recentMessages);
    }

    const summary = this.generateSummary(olderMessages);
    const summaryMessage: Message = {
      role: 'system',
      content: `[历史对话摘要]\n${summary}`,
    };

    const compressedMessages: Message[] = [
      { role: 'system', content: '你是一个有帮助的AI助手。以下是之前的对话摘要，请继续帮助用户。' },
      summaryMessage,
      ...recentMessages.filter(m => m.role !== 'system'),
    ];

    const compressedTokens = this.estimateMessagesTokens(compressedMessages);
    if (compressedTokens > this.config.maxTokens - this.config.reservedTokens) {
      return this.trimToFit(compressedMessages);
    }

    console.log(`Context compressed: ${messages.length} -> ${compressedMessages.length} messages, window=${windowSize}`);
    return compressedMessages;
  }

  private generateSummary(messages: Message[]): string {
    const topics: { question: string; answer: string }[] = [];
    let currentQuestion = '';
    let currentAnswer = '';

    for (const msg of messages) {
      if (msg.role === 'user') {
        if (currentQuestion && currentAnswer) {
          topics.push({ question: currentQuestion, answer: currentAnswer });
        }
        currentQuestion = (msg.content || '').substring(0, 100);
        currentAnswer = '';
      } else if (msg.role === 'assistant' && currentQuestion) {
        currentAnswer = (msg.content || '').substring(0, 200);
      } else if (msg.role === 'tool' && currentQuestion) {
        const result = msg.content || '';
        if (result.includes('success')) {
          currentAnswer += ' [工具执行成功]';
        }
      }
    }

    if (currentQuestion && currentAnswer) {
      topics.push({ question: currentQuestion, answer: currentAnswer });
    }

    if (topics.length === 0) {
      return '之前的对话内容已被压缩。';
    }

    const summaryLines = topics.slice(-10).map((t, i) => 
      `${i + 1}. 用户问: ${t.question}...\n   回答: ${t.answer}...`
    );

    return `共${topics.length}轮对话，最近内容:\n${summaryLines.join('\n')}`;
  }

  private trimToFit(messages: Message[]): Message[] {
    const targetTokens = this.config.maxTokens - this.config.reservedTokens;
    const result: Message[] = [];
    let currentTokens = 0;

    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      const msgTokens = this.estimateTokens((msg.content || '') + (msg.reasoning || ''));

      if (currentTokens + msgTokens <= targetTokens) {
        result.unshift(msg);
        currentTokens += msgTokens;
      } else {
        break;
      }
    }

    if (result.length === 0 && messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      result.push({
        ...lastMsg,
        content: this.truncateText(lastMsg.content || '', targetTokens - 100),
      });
    }

    return result;
  }

  private truncateText(text: string, maxTokens: number): string {
    const estimatedChars = maxTokens * 2;
    if (text.length <= estimatedChars) {
      return text;
    }
    return text.substring(0, estimatedChars) + '...[内容已截断]';
  }

  updateConfig(config: Partial<ContextConfig>): void {
    this.config = { ...this.config, ...config };
  }

  extractKeyInformation(messages: Message[]): string[] {
    const keyInfo: string[] = [];
    
    for (const msg of messages) {
      if (msg.role === 'user') {
        const questions = (msg.content || '').match(/[^。！？.!?]+[？?]/g);
        if (questions) {
          keyInfo.push(...questions.map(q => q.trim()));
        }
      }
    }

    return [...new Set(keyInfo)].slice(-10);
  }

  getContextWindow(messages: Message[], windowSize: number = 10): Message[] {
    if (messages.length <= windowSize) {
      return messages;
    }
    return messages.slice(-windowSize);
  }
}

export const contextManager = new ContextManager();