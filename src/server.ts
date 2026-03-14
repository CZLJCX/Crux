import express, { Request, Response } from 'express';
import { Agent, sessionManager, configManager } from '../src/core/index.js';
import { registerBuiltInTools } from '../src/tools/index.js';
import type { Message } from '../src/core/types.js';

registerBuiltInTools();

const app = express();
app.use(express.json());

const sessions = new Map<string, any>();

app.get('/api/config', (req: Request, res: Response) => {
  const config = configManager.get();
  res.json(config);
});

app.put('/api/config', (req: Request, res: Response) => {
  const { apiKey, model, baseURL, temperature } = req.body;
  if (apiKey) {
    configManager.updateAPI({ apiKey });
  }
  if (model) {
    configManager.updateAPI({ model });
  }
  if (baseURL) {
    configManager.updateAPI({ baseURL });
  }
  if (temperature !== undefined) {
    configManager.updateAPI({ temperature: parseFloat(temperature) });
  }
  res.json({ success: true });
});

app.get('/api/sessions', (req: Request, res: Response) => {
  const list = sessionManager.list();
  res.json(list);
});

app.post('/api/sessions', (req: Request, res: Response) => {
  const { name } = req.body;
  const session = sessionManager.create(name);
  res.json({ id: session.id, name: session.name });
});

app.get('/api/sessions/:id', (req: Request, res: Response) => {
  const id = req.params.id as string;
  const session = sessionManager.load(id);
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }
  res.json({ id: session.id, name: session.name, messages: session.messages });
});

app.delete('/api/sessions/:id', (req: Request, res: Response) => {
  const id = req.params.id as string;
  try {
    sessionManager.delete(id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete session' });
  }
});

app.post('/api/chat', async (req: Request, res: Response) => {
  const { messages, sessionId } = req.body as { messages: Message[]; sessionId?: string };
  
  if (!messages || !Array.isArray(messages)) {
    res.status(400).json({ error: 'Invalid messages' });
    return;
  }

  const config = configManager.get();
  if (!config.api.apiKey) {
    res.status(400).json({ error: 'API key not configured' });
    return;
  }

  const agent = new Agent();
  agent.setApiKey(config.api.apiKey);
  agent.setModel(config.api.model);

  try {
    const result = await agent.chat(messages);
    
    if (sessionId) {
      for (const msg of messages) {
        sessionManager.addMessage(sessionId, msg);
      }
      if (result.content) {
        sessionManager.addMessage(sessionId, { role: 'assistant', content: result.content });
      }
    }
    
    res.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

app.post('/api/chat/stream', async (req: Request, res: Response) => {
  const { messages, sessionId } = req.body as { messages: Message[]; sessionId?: string };
  
  if (!messages || !Array.isArray(messages)) {
    res.status(400).json({ error: 'Invalid messages' });
    return;
  }

  const config = configManager.get();
  if (!config.api.apiKey) {
    res.status(400).json({ error: 'API key not configured' });
    return;
  }

  if (sessionId) {
    for (const msg of messages) {
      sessionManager.addMessage(sessionId, msg);
    }
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'close');
  res.flushHeaders();

  const agent = new Agent();
  agent.setApiKey(config.api.apiKey);
  agent.setModel(config.api.model);
  agent.setBaseURL(config.api.baseURL);
  agent.setTemperature(config.api.temperature);

  let fullContent = '';
  let fullReasoning = '';

  try {
    for await (const chunk of agent.streamChatIter(messages)) {
      if (chunk.type === 'content') {
        fullContent += chunk.data;
        res.write(`data: ${JSON.stringify({ type: 'content', data: chunk.data })}\n\n`);
      } else if (chunk.type === 'reasoning') {
        fullReasoning += chunk.data;
        res.write(`data: ${JSON.stringify({ type: 'reasoning', data: chunk.data })}\n\n`);
      } else if (chunk.type === 'response_end') {
        if (sessionId && (fullContent || fullReasoning)) {
          sessionManager.addMessage(sessionId, { 
            role: 'assistant', 
            content: fullContent, 
            reasoning: fullReasoning 
          });
        }
        fullContent = '';
        fullReasoning = '';
        res.write(`data: ${JSON.stringify({ type: 'response_end', data: '' })}\n\n`);
      } else if (chunk.type === 'tool_call') {
        res.write(`data: ${JSON.stringify({ type: 'tool_call', data: chunk.data })}\n\n`);
      } else if (chunk.type === 'tool_result') {
        res.write(`data: ${JSON.stringify({ type: 'tool_result', data: chunk.data })}\n\n`);
      } else if (chunk.type === 'done') {
        res.write(`data: ${JSON.stringify({ type: 'done', data: '' })}\n\n`);
      }
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.write(`data: ${JSON.stringify({ type: 'error', data: message })}\n\n`);
  }

  res.end();
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});