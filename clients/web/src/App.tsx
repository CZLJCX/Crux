import { useState, useEffect, useRef, useCallback } from 'react';

interface Message {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  reasoning?: string;
  tool_call_id?: string;
}

interface Session {
  id: string;
  name: string;
  created_at: number;
  updated_at: number;
  message_count: number;
  preview: string;
}

const API_BASE = '/api';

function App() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('gpt-4o');
  const [currentReasoning, setCurrentReasoning] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const reasoningEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const scrollReasoningToBottom = useCallback(() => {
    reasoningEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    scrollReasoningToBottom();
  }, [currentReasoning, scrollReasoningToBottom]);

  useEffect(() => {
    loadSessions();
    loadConfig();
  }, []);

  async function loadConfig() {
    try {
      const res = await fetch(`${API_BASE}/config`);
      const data = await res.json();
      setApiKey(data.api?.apiKey || '');
      setModel(data.api?.model || 'gpt-4o');
    } catch (e) {
      console.error('Failed to load config:', e);
    }
  }

  async function loadSessions() {
    try {
      const res = await fetch(`${API_BASE}/sessions`);
      const sessionList = await res.json();
      setSessions(sessionList);
      if (sessionList.length > 0 && !currentSessionId) {
        selectSession(sessionList[0].id);
      }
    } catch (e) {
      console.error('Failed to load sessions:', e);
    }
  }

  async function selectSession(id: string) {
    setCurrentSessionId(id);
    setCurrentReasoning('');
    try {
      const res = await fetch(`${API_BASE}/sessions/${id}`);
      const data = await res.json();
      setMessages(data.messages || []);
    } catch (e) {
      console.error('Failed to load session:', e);
      setMessages([]);
    }
  }

  async function createSession() {
    try {
      const res = await fetch(`${API_BASE}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: `Session ${new Date().toLocaleString()}` }),
      });
      const session = await res.json();
      await loadSessions();
      selectSession(session.id);
    } catch (e) {
      console.error('Failed to create session:', e);
    }
  }

  async function saveConfig() {
    try {
      await fetch(`${API_BASE}/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey, model }),
      });
      setShowConfig(false);
    } catch (e) {
      console.error('Failed to save config:', e);
    }
  }

  async function sendMessage() {
    if (!input.trim() || loading) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);
    setCurrentReasoning('');

    try {
      const res = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [...messages, userMessage] }),
      });

      const data = await res.json();

      if (data.reasoning) {
        const assistantMessage: Message = { 
          role: 'assistant', 
          content: data.content || '',
          reasoning: data.reasoning 
        };
        setMessages(prev => [...prev, assistantMessage]);
      } else if (data.content) {
        const assistantMessage: Message = { role: 'assistant', content: data.content };
        setMessages(prev => [...prev, assistantMessage]);
      }

      if (data.tool_results) {
        for (const tr of data.tool_results) {
          const toolMessage: Message = { role: 'tool', content: tr.output, tool_call_id: tr.tool_call_id };
          setMessages(prev => [...prev, toolMessage]);
        }
      }
    } catch (e) {
      console.error('Failed to send message:', e);
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${e}` }]);
    } finally {
      setLoading(false);
      setCurrentReasoning('');
    }
  }

  return (
    <div className="app">
      <header className="header">
        <h1>Crux <span style={{fontSize: '12px', fontWeight: 'normal', opacity: 0.6}}>by CZLJ</span></h1>
        <button className="config-btn" onClick={() => setShowConfig(true)}>
          ⚙ Settings
        </button>
      </header>

      <main className="main">
        <aside className="sidebar">
          <div className="sidebar-header">
            <h2>Sessions</h2>
            <button className="config-btn" onClick={createSession}>
              + New
            </button>
          </div>
          <div className="session-list">
            {sessions.map(session => (
              <div
                key={session.id}
                className={`session-item ${session.id === currentSessionId ? 'active' : ''}`}
                onClick={() => selectSession(session.id)}
              >
                <h3>{session.name}</h3>
                <p>{session.message_count} messages</p>
              </div>
            ))}
          </div>
        </aside>

        <div className="chat-area">
          <div className="messages">
            {messages.map((msg, i) => (
              <div key={i} className={`message ${msg.role}`}>
                <div className="message-role">
                  {msg.role === 'user' ? 'You' : msg.role === 'assistant' ? 'Assistant' : msg.role === 'tool' ? 'Tool Result' : 'System'}
                </div>
                {msg.reasoning && (
                  <div className="message-reasoning">
                    <div className="reasoning-header">🤔 Reasoning</div>
                    <pre className="reasoning-content">{msg.reasoning}</pre>
                  </div>
                )}
                <div className="message-content">{msg.content}</div>
              </div>
            ))}
            {loading && (
              <div className="message assistant">
                <div className="message-role">Assistant</div>
                <div className="message-content">
                  <div className="loading">
                    <div className="spinner"></div>
                    <span>Thinking...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {(currentReasoning || loading) && (
            <div className="reasoning-area">
              <div className="reasoning-header">🤔 Reasoning</div>
              <pre className="reasoning-content">
                {currentReasoning || 'Thinking...'}
                <div ref={reasoningEndRef} />
              </pre>
            </div>
          )}

          <div className="input-area">
            <div className="input-wrapper">
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                placeholder="Type your message... (Enter to send)"
                disabled={loading}
              />
              <button onClick={sendMessage} disabled={loading || !input.trim()}>
                Send
              </button>
            </div>
          </div>
        </div>
      </main>

      {showConfig && (
        <div className="modal-overlay" onClick={() => setShowConfig(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Settings</h2>
            <div className="form-group">
              <label>OpenAI API Key</label>
              <input
                type="password"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder="sk-..."
              />
            </div>
            <div className="form-group">
              <label>Model</label>
              <input
                type="text"
                value={model}
                onChange={e => setModel(e.target.value)}
                placeholder="gpt-4o"
              />
            </div>
            <div className="modal-actions">
              <button className="config-btn" onClick={() => setShowConfig(false)}>
                Cancel
              </button>
              <button className="config-btn" style={{ background: 'var(--accent)', borderColor: 'var(--accent)' }} onClick={saveConfig}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;