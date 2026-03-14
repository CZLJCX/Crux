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

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});