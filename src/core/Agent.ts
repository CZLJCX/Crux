import { Message, ToolCall, ToolResult, StreamCallback, ReasoningCallback } from './types.js';
import { LLMConnector } from './LLMConnector.js';
import { toolRegistry } from './ToolRegistry.js';
import { sessionManager } from './SessionManager.js';
import { configManager } from './config.js';
import { contextManager } from './ContextManager.js';

export interface ChatOptions {
  streamCallback?: StreamCallback;
  reasoningCallback?: ReasoningCallback;
  useContextCompression?: boolean;
  maxRetries?: number;
}

interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  retryableErrors: string[];
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
  retryableErrors: [
    'ECONNRESET',
    'ETIMEDOUT',
    'ENOTFOUND',
    'rate_limit',
    'overloaded',
    'timeout',
    'network',
  ],
};

export class Agent {
  private llm: LLMConnector;
  private systemPrompt: string;
  private retryConfig: RetryConfig;

  constructor(systemPrompt?: string) {
    this.llm = new LLMConnector();
    this.systemPrompt = systemPrompt || this.getDefaultSystemPrompt();
    this.retryConfig = DEFAULT_RETRY_CONFIG;
  }

  private getDefaultSystemPrompt(): string {
    return `# Crux AI Agent

## 角色定义
你是一个名为 Crux 的智能 AI 助手，具备强大的工具调用能力和问题解决能力。你专注于代码生成、项目开发和自动化任务，设计目标是帮助用户高效完成各类编程任务。

## 核心工具能力

### 文件与系统
1. **shell** - 执行 Shell 命令，支持跨平台
2. **file** - 文件读写、目录操作、文件管理
3. **glob** - 文件模式匹配搜索
4. **grep** - 内容正则搜索

### 代码开发
5. **code_runner** - 执行 JavaScript/TypeScript/Python 代码
6. **dependency** - 依赖管理 (npm/pip)，安装、更新、检查
7. **code_analysis** - 代码结构分析、函数提取、复杂度评估
8. **scaffold** - 项目脚手架、模板生成、配置文件创建

### 辅助工具
9. **web_fetch** - 获取网页内容
10. **time** - 时间日期操作
11. **calculator** - 数学计算
12. **json** - JSON 处理

## 代码生成专精

### 支持语言
- **JavaScript/TypeScript**: Node.js, React, Vue, Next.js, Express, NestJS
- **Python**: Django, Flask, FastAPI, 数据分析, 脚本
- **Shell**: Bash, PowerShell 脚本
- **其他**: Go, Rust, Java, C/C++ 基础支持

### 代码质量标准
- 遵循语言最佳实践和惯用写法
- 使用现代语法特性 (ES6+, Python 3.8+)
- 添加类型注解 (TypeScript, Python type hints)
- 处理边界情况和错误
- 编写清晰的注释和文档

### 项目结构模板

**React + TypeScript 项目**
\`\`\`
src/
├── components/     # UI组件
│   ├── common/     # 通用组件
│   └── features/   # 功能组件
├── hooks/          # 自定义Hooks
├── services/       # API服务
├── utils/          # 工具函数
├── types/          # 类型定义
└── styles/         # 样式文件
\`\`\`

**Node.js 后端项目**
\`\`\`
src/
├── routes/         # 路由定义
├── controllers/    # 控制器
├── services/       # 业务逻辑
├── models/         # 数据模型
├── middlewares/    # 中间件
├── utils/          # 工具函数
└── types/          # 类型定义
\`\`\`

**Python 项目**
\`\`\`
src/
├── api/            # API路由
├── services/       # 业务逻辑
├── models/         # 数据模型
├── utils/          # 工具函数
├── tests/          # 测试文件
└── config/         # 配置文件
\`\`\`

## 代码模板库

### React 函数组件
\`\`\`tsx
interface Props {
  title: string;
  onAction?: () => void;
}

export function Component({ title, onAction }: Props) {
  const [state, setState] = useState(initialState);
  
  useEffect(() => {
    // side effects
  }, []);
  
  return (
    <div className="container">
      <h1>{title}</h1>
      <button onClick={onAction}>Action</button>
    </div>
  );
}
\`\`\`

### Node.js API 路由
\`\`\`typescript
router.get('/api/resource/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const data = await service.getById(id);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
\`\`\`

### FastAPI 路由
\`\`\`python
@router.get("/api/resource/{id}")
async def get_resource(id: str):
    try:
        data = await service.get_by_id(id)
        return {"success": True, "data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
\`\`\`

### Python 数据类
\`\`\`python
from dataclasses import dataclass
from typing import Optional

@dataclass
class Entity:
    id: str
    name: str
    value: Optional[float] = None
    
    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "value": self.value
        }
\`\`\`

## 开发工作流程

1. **需求分析** → 理解功能需求和约束条件
2. **方案设计** → 选择技术栈和架构模式
3. **项目初始化** → 使用 scaffold 创建项目结构
4. **依赖安装** → 使用 dependency 安装必要依赖
5. **代码实现** → 编写核心功能代码
6. **代码执行** → 使用 code_runner 测试验证
7. **代码分析** → 使用 code_analysis 检查质量
8. **优化迭代** → 根据结果持续改进

## 工具使用策略

### 代码开发场景
- 新建项目 → scaffold + dependency
- 编写代码 → file + code_runner
- 调试问题 → code_runner + code_analysis
- 重构代码 → code_analysis + file

### 文件操作场景
- 搜索代码 → glob + grep
- 批量修改 → file + shell
- 项目结构 → scaffold

### 系统操作场景
- 环境配置 → shell + dependency
- 自动化脚本 → shell + code_runner

## 输出规范

### 回复格式
- 使用 Markdown 组织内容
- 代码块必须指定语言
- 复杂逻辑用表格/列表说明

### 代码输出
- 完整可运行的代码
- 包含必要 import 语句
- 添加关键注释
- 遵循命名规范

### 沟通风格
- 直接给出解决方案
- 解释关键决策
- 提供多种方案时说明优劣

## 安全准则

- 不执行危险的系统命令
- 不删除重要文件
- 不暴露敏感信息
- 代码执行有超时限制

---
始终以专业、高效的方式帮助用户。代码优先，解释为辅。遇到问题时，主动给出解决方案。`;
  }

  setSystemPrompt(prompt: string): void {
    this.systemPrompt = prompt;
  }

  private isRetryableError(error: Error): boolean {
    const errorMessage = error.message.toLowerCase();
    return this.retryConfig.retryableErrors.some(e => 
      errorMessage.includes(e.toLowerCase())
    );
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private calculateBackoff(attempt: number): number {
    const delay = Math.min(
      this.retryConfig.baseDelayMs * Math.pow(2, attempt),
      this.retryConfig.maxDelayMs
    );
    return delay + Math.random() * 1000;
  }

  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;
        
        if (!this.isRetryableError(error)) {
          throw error;
        }
        
        if (attempt < this.retryConfig.maxRetries) {
          const backoffMs = this.calculateBackoff(attempt);
          console.warn(`${operationName} failed (attempt ${attempt + 1}/${this.retryConfig.maxRetries + 1}), retrying in ${backoffMs}ms...`);
          await this.delay(backoffMs);
        }
      }
    }
    
    throw lastError;
  }

  private async executeToolWithRetry(
    toolName: string,
    args: Record<string, unknown>,
    maxRetries: number = 3
  ): Promise<{ result: string; success: boolean; attempts: number }> {
    let lastError: Error | null = null;
    let attempts = 0;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      attempts++;
      try {
        const result = await toolRegistry.execute(toolName, args);
        return { result, success: true, attempts };
      } catch (error: any) {
        lastError = error;
        
        if (attempt < maxRetries - 1) {
          const backoffMs = Math.min(1000 * Math.pow(2, attempt), 5000);
          await this.delay(backoffMs);
        }
      }
    }
    
    return {
      result: JSON.stringify({ 
        error: lastError?.message || 'Unknown error',
        tool: toolName,
        attempts 
      }),
      success: false,
      attempts
    };
  }

  private prepareMessages(
    messages: Message[],
    useContextCompression: boolean = true
  ): Message[] {
    const systemMessage: Message = {
      role: 'system',
      content: this.systemPrompt,
    };

    const allMessages = [systemMessage, ...messages];

    if (useContextCompression) {
      const stats = contextManager.getStats(allMessages);
      if (stats.needsCompression) {
        console.log(`Context compression triggered: ${stats.utilizationPercent}% utilization, ${stats.totalTokens} tokens`);
        return contextManager.compressForLLM(allMessages);
      }
    }

    return allMessages;
  }

  async chat(
    messages: Message[],
    streamCallback?: StreamCallback,
    reasoningCallback?: ReasoningCallback,
    options?: ChatOptions
  ): Promise<{ content: string; reasoning?: string; toolCalls?: ToolCall[]; toolResults?: ToolResult[] }> {
    const tools = toolRegistry.getOpenAITools();
    let allToolResults: ToolResult[] = [];
    let allToolCalls: ToolCall[] = [];
    let fullReasoning = '';
    
    const useContextCompression = options?.useContextCompression ?? true;
    const maxRetries = options?.maxRetries ?? 3;

    if (streamCallback || reasoningCallback) {
      let currentMessages = this.prepareMessages(messages, useContextCompression);
      let loopCount = 0;
      const maxLoops = 10;

      while (loopCount < maxLoops) {
        loopCount++;
        let fullContent = '';

        try {
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
        } catch (streamError: any) {
          if (streamCallback) {
            streamCallback(`\n[Stream Error] ${streamError.message}\n`, true);
          }
        }

        const response = await this.executeWithRetry(
          () => this.llm.chatWithTools(currentMessages, tools),
          'chatWithTools'
        );
        
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
            
            const args = JSON.parse(tc.function.arguments);
            const { result, success, attempts } = await this.executeToolWithRetry(
              tc.function.name,
              args,
              maxRetries
            );
            
            allToolResults.push({
              tool_call_id: tc.id,
              output: result,
              is_error: !success,
            });
            
            if (streamCallback) {
              if (success) {
                streamCallback(`\n[Result] ${result.substring(0, 300)}${attempts > 1 ? ` (retried ${attempts}x)` : ''}...\n`, true);
              } else {
                streamCallback(`\n[Error] ${result}\n`, true);
              }
            }
          }

          const toolMessages: Message[] = allToolResults.map(tr => ({
            role: 'tool' as const,
            content: tr.output,
            tool_call_id: tr.tool_call_id,
          }));

          currentMessages = [
            ...currentMessages,
            { role: 'assistant' as const, content: fullContent, tool_calls: response.toolCalls },
            ...toolMessages
          ];
          
          if (contextManager.getStats(currentMessages).needsCompression) {
            currentMessages = contextManager.compressForLLM(currentMessages);
          }
        } else {
          return { content: fullContent, reasoning: fullReasoning, toolCalls: allToolCalls, toolResults: allToolResults };
        }
      }

      return { content: '', reasoning: fullReasoning, toolCalls: allToolCalls, toolResults: allToolResults };
    }

    let currentMessages = this.prepareMessages(messages, useContextCompression);
    let loopCount = 0;
    const maxLoops = 10;

    while (loopCount < maxLoops) {
      loopCount++;
      const response = await this.executeWithRetry(
        () => this.llm.chatWithTools(currentMessages, tools),
        'chatWithTools'
      );
      
      if (response.reasoning) {
        fullReasoning = response.reasoning;
      }
      
      if (response.toolCalls && response.toolCalls.length > 0) {
        allToolCalls.push(...response.toolCalls);
        const toolResults: ToolResult[] = [];

        for (const tc of response.toolCalls) {
          const args = JSON.parse(tc.function.arguments);
          const { result, success } = await this.executeToolWithRetry(
            tc.function.name,
            args,
            maxRetries
          );
          
          toolResults.push({
            tool_call_id: tc.id,
            output: result,
            is_error: !success,
          });
        }

        allToolResults.push(...toolResults);

        const toolMessages: Message[] = toolResults.map(tr => ({
          role: 'tool' as const,
          content: tr.output,
          tool_call_id: tr.tool_call_id,
        }));

        currentMessages = [
          ...currentMessages,
          { role: 'assistant' as const, content: response.content, tool_calls: response.toolCalls },
          ...toolMessages
        ];
        
        if (contextManager.getStats(currentMessages).needsCompression) {
          currentMessages = contextManager.compressForLLM(currentMessages);
        }
      } else {
        return { content: response.content, reasoning: fullReasoning, toolCalls: allToolCalls, toolResults: allToolResults };
      }
    }

    return { content: '', reasoning: fullReasoning, toolCalls: allToolCalls, toolResults: allToolResults };
  }

  async *streamChatIter(
    messages: Message[]
  ): AsyncGenerator<{ type: 'content' | 'reasoning' | 'tool_call' | 'tool_result' | 'response_end' | 'done'; data: string }> {
    const tools = toolRegistry.getOpenAITools();
    let currentMessages = [...messages];
    let loopCount = 0;
    const maxLoops = 10;

    while (loopCount < maxLoops) {
      loopCount++;
      let toolCallBuffer = '';
      let pendingReasoning = '';
      let hasContent = false;

      for await (const chunk of this.llm.streamChatWithTools(currentMessages, tools, (tc) => {
        toolCallBuffer = JSON.stringify(tc);
      }, (reasoning) => {
        pendingReasoning += reasoning;
      })) {
        if (pendingReasoning) {
          yield { type: 'reasoning', data: pendingReasoning };
          pendingReasoning = '';
        }
        if (chunk) {
          hasContent = true;
          yield { type: 'content', data: chunk };
        }
      }

      if (pendingReasoning) {
        yield { type: 'reasoning', data: pendingReasoning };
      }

      if (toolCallBuffer) {
        yield { type: 'response_end', data: '' };
        yield { type: 'tool_call', data: toolCallBuffer };
        
        const tc = JSON.parse(toolCallBuffer);
        const args = JSON.parse(tc.function.arguments);
        
        let result: string;
        try {
          result = await toolRegistry.execute(tc.function.name, args);
        } catch (error: any) {
          result = JSON.stringify({ error: error.message });
        }
        yield { type: 'tool_result', data: result };

        const toolMessage: Message = {
          role: 'tool',
          content: result,
          tool_call_id: tc.id,
        };
        
        currentMessages = [
          ...currentMessages,
          { role: 'assistant', content: '', tool_calls: [tc] } as Message,
          toolMessage
        ];
      } else {
        yield { type: 'response_end', data: '' };
        yield { type: 'done', data: '' };
        return;
      }
    }

    yield { type: 'response_end', data: '' };
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