#!/usr/bin/env node
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { marked } from 'marked';
import { Agent, sessionManager, configManager } from '../../core/index.js';
import { registerBuiltInTools } from '../../tools/index.js';
import { Message, SessionSummary } from '../../core/types.js';
import { Updater } from '../../utils/updater.js';

const args = process.argv.slice(2);

if (args.includes('-u') || args.includes('--update')) {
  const updater = new Updater();
  updater.update().catch(console.error);
  process.exit(0);
}

registerBuiltInTools();

class CLI {
  private agent: Agent | null = null;
  private sessionId: string | null = null;

  constructor() {
  }

  async start() {
    console.clear();
    this.printBanner();

    const config = configManager.get();

    if (!config.api.apiKey) {
      await this.setupApiKey();
    }

    this.agent = new Agent();

    await this.mainLoop();
  }

  private printBanner() {
    console.log(chalk.cyan(`
    ╭─────────────────────────────────────────────────────────────────────╮
    │                                                                     │
    │   ${chalk.white(' ██████╗██████╗ ██╗   ██╗██╗  ██╗ ██████╗██╗      █████╗ ██╗    ██╗')}  │
    │   ${chalk.white('██╔════╝██╔══██╗██║   ██║╚██╗██╔╝██╔════╝██║     ██╔══██╗██║    ██║')}  │
    │   ${chalk.white('██║     ██████╔╝██║   ██║ ╚███╔╝ ██║     ██║     ███████║██║ █╗ ██║')}  │
    │   ${chalk.white('██║     ██╔══██╗██║   ██║ ██╔██╗ ██║     ██║     ██╔══██║██║███╗██║')}  │
    │   ${chalk.white('╚██████╗██║  ██║╚██████╔╝██╔╝ ██╗╚██████╗███████╗██║  ██║╚███╔███╔╝')}  │
    │   ${chalk.white(' ╚═════╝╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═╝ ╚═════╝╚══════╝╚═╝  ╚═╝ ╚══╝╚══╝')}  │
    │                                                                     │
    │   ${chalk.gray('© 2024-2026')} ${chalk.white('CZLJ')} ${chalk.gray('. All rights reserved.')}                      │
    │   ${chalk.gray('│ Powerful AI Agent for CLI, Web & Desktop')}                     │
    ╰─────────────────────────────────────────────────────────────────────╯
    `));
    console.log(chalk.gray('   Type ') + chalk.white('/help') + chalk.gray(' for commands, ') + chalk.white('/exit') + chalk.gray(' to quit.\n'));
  }

  private async setupApiKey() {
    console.log(chalk.yellow('  ╭─────────────────────────────────'));
    console.log(chalk.yellow('  │ ') + chalk.yellow('API key not configured'));
    console.log(chalk.yellow('  ╰─────────────────────────────────'));
    console.log(chalk.gray('  Please enter your OpenAI API key.\n'));
    
    const { apiKey } = await inquirer.prompt([
      {
        type: 'input',
        name: 'apiKey',
        message: chalk.cyan('  API Key') + chalk.gray(':'),
        validate: (input) => input.trim().length > 0 || 'Please enter a valid API key',
      },
    ]);

    configManager.updateAPI({ apiKey: apiKey.trim() });
    console.log(chalk.green('\n  ✓ API key saved!\n'));
  }

  private async mainLoop() {
    while (true) {
      const sessions = sessionManager.list();
      
      if (!this.sessionId || !sessionManager.load(this.sessionId)) {
        if (sessions.length > 0) {
          const choice = await this.chooseSession(sessions);
          if (choice === 'new') {
            await this.createNewSession();
          } else if (choice === 'quit') {
            console.log(chalk.gray('\n  Goodbye!\n'));
            process.exit(0);
          } else {
            this.sessionId = choice;
            sessionManager.load(choice);
          }
        } else {
          await this.createNewSession();
        }
      }

      const session = sessionManager.getCurrent();
      if (!session) {
        await this.createNewSession();
        continue;
      }

      console.log(chalk.cyan('  ╭─────────────────────────────────'));
      console.log(chalk.cyan('  │ ') + chalk.white('Session: ') + chalk.gray(session.name));
      console.log(chalk.cyan('  ╰─────────────────────────────────\n'));

      const { userInput } = await inquirer.prompt([
        {
          type: 'input',
          name: 'userInput',
          message: chalk.cyan('➤ ') + chalk.white(''),
        },
      ]);

      if (userInput.toLowerCase() === '/help' || userInput.toLowerCase() === '/h') {
        this.printHelp();
        continue;
      }

      if (userInput.toLowerCase() === '/new' || userInput.toLowerCase() === '/n') {
        await this.createNewSession();
        continue;
      }

      if (userInput.toLowerCase() === '/sessions' || userInput.toLowerCase() === '/s') {
        const choice = await this.chooseSession(sessionManager.list());
        if (choice === 'new') {
          await this.createNewSession();
        } else if (choice) {
          this.sessionId = choice;
          sessionManager.load(choice);
        }
        continue;
      }

      if (userInput.toLowerCase() === '/exit' || userInput.toLowerCase() === '/e') {
        console.log(chalk.gray('\n  Goodbye!\n'));
        process.exit(0);
      }

      if (userInput.trim()) {
        await this.processMessage(userInput);
      }
    }
  }

  private async chooseSession(sessions: SessionSummary[]): Promise<string | 'new' | 'quit'> {
    const choices = sessions.map(s => ({
      name: chalk.gray(s.name) + chalk.gray(' (') + chalk.white(s.message_count.toString()) + chalk.gray(' msgs)'),
      value: s.id,
    }));

    choices.push({ name: chalk.green('+ New Session'), value: 'new' });
    choices.push({ name: chalk.red('Exit'), value: 'quit' });

    const { choice } = await inquirer.prompt([
      {
        type: 'list',
        name: 'choice',
        message: chalk.cyan('  Choose session:'),
        choices,
        pageSize: 10,
      },
    ]);

    return choice;
  }

  private async createNewSession() {
    const { name } = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: chalk.cyan('  Session name') + chalk.gray(':'),
        default: `Session ${new Date().toLocaleString()}`,
      },
    ]);

    const session = sessionManager.create(name);
    this.sessionId = session.id;
    console.log(chalk.green('\n  ✓ Created: ') + chalk.white(name) + chalk.gray('\n'));
  }

  private stripMarkdown(text: string): string {
    const markdownHtml = marked.parse(text) as string;
    return markdownHtml
      .replace(/<[^>]*>/g, '')
      .replace(/&gt;/g, '>')
      .replace(/&lt;/g, '<')
      .replace(/&amp;/g, '&')
      .replace(/```(\w+)?\n([\s\S]*?)```/g, '\n$2\n')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/^### (.+)$/gm, '$1')
      .replace(/^## (.+)$/gm, '$1')
      .replace(/^# (.+)$/gm, '$1')
      .replace(/^- (.+)$/gm, '• $1')
      .replace(/^\d+\. (.+)$/gm, '○ $1');
  }

  private printReasoning(reasoning: string) {
    if (!reasoning) return;
    
    console.log();
    console.log(chalk.cyan('  ╭─────────────────────────────────'));
    console.log(chalk.cyan('  │ ') + chalk.yellow('🤔 Reasoning'));
    console.log(chalk.cyan('  ╰─────────────────────────────────'));
    
    const lines = reasoning.trim().split('\n');
    for (const line of lines) {
      const text = '  ' + this.stripMarkdown(line);
      console.log(chalk.gray(text));
    }
    console.log();
  }

  private printContent(content: string, label: string = 'Assistant') {
    if (!content) return;
    
    const plainText = this.stripMarkdown(content);
    
    console.log();
    console.log(chalk.cyan('  ╭─────────────────────────────────'));
    console.log(chalk.cyan('  │ ') + chalk.white.bold(`${label}:`));
    console.log(chalk.cyan('  ╰─────────────────────────────────'));
    console.log(chalk.white('  ' + plainText.trim().split('\n').join('\n  ')));
    console.log();
  }

  private printToolCall(toolName: string, isStart: boolean = true) {
    if (isStart) {
      console.log(chalk.yellow(`\n  [🤔 Using tool: ${toolName}]`));
    } else {
      console.log(chalk.green(`\n  [✓ Tool completed: ${toolName}]`));
    }
  }

  private async processMessage(input: string) {
    const session = sessionManager.getCurrent();
    if (!session) return;

    const userMessage: Message = { role: 'user', content: input };
    sessionManager.addMessage(session.id, userMessage);

    const messages: Message[] = session.messages.map(m => ({
      role: m.role,
      content: m.content,
      tool_call_id: m.tool_call_id,
      tool_calls: m.tool_calls,
    }));

    const spinner = ora({ text: chalk.cyan('  Thinking...'), spinner: 'dots' }).start();
    let fullResponse = '';
    let fullReasoning = '';

    if (!this.agent) {
      spinner.stop();
      console.log(chalk.red('\n  ╭─────────────────────────────────'));
      console.log(chalk.red('  │ ') + chalk.red('Agent not initialized'));
      console.log(chalk.red('  ╰─────────────────────────────────\n'));
      return;
    }

    try {
      const { content, reasoning, toolCalls, toolResults } = await this.agent.chat(
        messages,
        (chunk, isTool) => {
          if (isTool) {
            fullResponse += '\n' + chunk;
          } else {
            fullResponse += chunk;
          }
        },
        (reasoningChunk) => {
          fullReasoning += reasoningChunk;
        }
      );

      spinner.stop();

      if (fullReasoning) {
        this.printReasoning(fullReasoning);
      }

      const rawContent = content || fullResponse;
      if (rawContent) {
        this.printContent(rawContent);
      }

      const assistantMessage: Message = { 
        role: 'assistant', 
        content: content || fullResponse,
        reasoning: fullReasoning || reasoning,
        tool_calls: toolCalls,
      };
      sessionManager.addMessage(session.id, assistantMessage);

      if (toolResults) {
        for (const tr of toolResults) {
          const toolMessage: Message = {
            role: 'tool',
            content: tr.output,
            tool_call_id: tr.tool_call_id,
          };
          sessionManager.addMessage(session.id, toolMessage);
        }
      }
    } catch (error: any) {
      spinner.stop();
      console.log(chalk.red('\n  ╭─────────────────────────────────'));
      console.log(chalk.red('  │ ') + chalk.red('Error: ') + chalk.white(error.message));
      console.log(chalk.red('  ╰─────────────────────────────────\n'));
    }
  }

  private printHelp() {
    console.log(`
${chalk.cyan('  ╭─────────────────────────────────')}
${chalk.cyan('  │')} ${chalk.white.bold('Commands:')}
${chalk.cyan('  │')}
${chalk.cyan('  │')}   ${chalk.white('/help, /h')}      ${chalk.gray('Show this help')}
${chalk.cyan('  │')}   ${chalk.white('/new, /n')}       ${chalk.gray('Create new session')}
${chalk.cyan('  │')}   ${chalk.white('/sessions, /s')}  ${chalk.gray('Switch session')}
${chalk.cyan('  │')}   ${chalk.white('/exit, /e')}      ${chalk.gray('Exit the program')}
${chalk.cyan('  │')}
${chalk.cyan('  │')} ${chalk.white.bold('Global Flags:')}
${chalk.cyan('  │')}   ${chalk.white('-u, --update')}  ${chalk.gray('Update to latest version')}
${chalk.cyan('  │')}
${chalk.cyan('  │')} ${chalk.white.bold('Available Tools:')}
${chalk.cyan('  │')}   ${chalk.gray('•')} ${chalk.white('shell')}      ${chalk.gray('Execute shell commands')}
${chalk.cyan('  │')}   ${chalk.gray('•')} ${chalk.white('file')}       ${chalk.gray('Read, write, list files')}
${chalk.cyan('  │')}   ${chalk.gray('•')} ${chalk.white('glob')}       ${chalk.gray('Find files by pattern')}
${chalk.cyan('  │')}   ${chalk.gray('•')} ${chalk.white('grep')}       ${chalk.gray('Search in files')}
${chalk.cyan('  │')}   ${chalk.gray('•')} ${chalk.white('web_fetch')}  ${chalk.gray('Fetch web content')}
${chalk.cyan('  ╰─────────────────────────────────')}
`);
  }
}

const cli = new CLI();
cli.start().catch(console.error);