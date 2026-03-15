import express, { Request, Response, NextFunction } from 'express';
import { Agent, sessionManager, configManager, contextManager } from './core/index.js';
import { registerBuiltInTools } from './tools/index.js';
import type { Message } from './core/types.js';

registerBuiltInTools();

const app = express();
app.use(express.json());

app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

const DEFAULT_SESSION_ID = 'default-session';

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
  const { name, id } = req.body;
  const sessionId = id || name || DEFAULT_SESSION_ID;
  let session = sessionManager.load(sessionId);
  if (!session) {
    session = sessionManager.create(name || 'Crux Chat');
  }
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

interface MessageRequest {
  content: string;
  files?: Array<{ name: string; type: string; content: string; size: number }>;
  sessionId?: string;
}

app.post('/api/chat/message', async (req: Request, res: Response) => {
  try {
    const { content, files, sessionId } = req.body as MessageRequest;
    
    if (!content && (!files || files.length === 0)) {
      res.status(400).json({ error: 'Message content is required' });
      return;
    }

    const config = configManager.get();
    if (!config.api.apiKey) {
      res.status(400).json({ error: 'API key not configured. Please set your API key in settings.' });
      return;
    }

    const sid = sessionId || DEFAULT_SESSION_ID;
    let session = sessionManager.load(sid);
    if (!session) {
      session = sessionManager.create('Crux Chat');
    }

    const userMessage: Message = {
      role: 'user',
      content: content || '',
      files: files,
    };
    sessionManager.addMessage(sid, userMessage);

    session = sessionManager.load(sid);
    if (!session) {
      res.status(500).json({ error: 'Session not found after save' });
      return;
    }

    const allMessages = session.messages;
    const stats = contextManager.getStats(allMessages);
    console.log(`Context stats: ${stats.messageCount} messages, ~${stats.totalTokens} tokens, ${stats.utilizationPercent}% utilization`);

    const compressedMessages = contextManager.compressForLLM(allMessages);

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
      for await (const chunk of agent.streamChatIter(compressedMessages)) {
        if (chunk.type === 'content') {
          fullContent += chunk.data;
          res.write(`data: ${JSON.stringify({ type: 'content', data: chunk.data })}\n\n`);
        } else if (chunk.type === 'reasoning') {
          fullReasoning += chunk.data;
          res.write(`data: ${JSON.stringify({ type: 'reasoning', data: chunk.data })}\n\n`);
        } else if (chunk.type === 'response_end') {
          if (fullContent || fullReasoning) {
            sessionManager.addMessage(sid, {
              role: 'assistant',
              content: fullContent,
              reasoning: fullReasoning,
            });
          }
          fullContent = '';
          fullReasoning = '';
          res.write(`data: ${JSON.stringify({ type: 'response_end', data: '' })}\n\n`);
        } else if (chunk.type === 'tool_call') {
          res.write(`data: ${JSON.stringify({ type: 'tool_call', data: chunk.data })}\n\n`);
        } else if (chunk.type === 'tool_result') {
          res.write(`data: ${JSON.stringify({ type: 'tool_result', data: chunk.data })}\n\n`);
          
          try {
            const tc = JSON.parse(chunk.data);
            sessionManager.addMessage(sid, {
              role: 'tool',
              content: chunk.data,
              tool_call_id: tc.id,
            });
          } catch (parseError) {
            console.error('Failed to parse tool_result:', parseError);
          }
        } else if (chunk.type === 'done') {
          res.write(`data: ${JSON.stringify({ type: 'done', data: '' })}\n\n`);
        }
      }
    } catch (streamError: unknown) {
      const errorMessage = streamError instanceof Error ? streamError.message : 'Unknown streaming error';
      console.error('Stream error:', errorMessage);
      res.write(`data: ${JSON.stringify({ type: 'error', data: errorMessage })}\n\n`);
    }

    res.end();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Request error:', error);
    res.status(500).json({ error: message });
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