import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/tauri';

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

function App() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentReasoning, setCurrentReasoning] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const reasoningEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadSessions();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    reasoningEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentReasoning]);

  async function loadSessions() {
    try {
      const sessionList = await invoke<Session[]>('list_sessions');
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
      const session = await invoke<{ messages: Message[] }>('load_session', { id });
      setMessages(session.messages || []);
    } catch (e) {
      console.error('Failed to load session:', e);
      setMessages([]);
    }
  }

  async function createSession() {
    try {
      const session = await invoke<{ id: string; name: string }>('create_session', {
        name: `Session ${new Date().toLocaleString()}`,
      });
      await loadSessions();
      selectSession(session.id);
    } catch (e) {
      console.error('Failed to create session:', e);
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
      const allMessages = [...messages, userMessage];
      const response = await invoke<{ content: string; reasoning?: string; tool_results?: Array<{ tool_call_id: string; output: string }> }>('send_message', {
        sessionId: currentSessionId,
        messages: allMessages,
      });

      if (response.reasoning) {
        const assistantMessage: Message = { 
          role: 'assistant', 
          content: response.content || '',
          reasoning: response.reasoning 
        };
        setMessages(prev => [...prev, assistantMessage]);
      } else if (response.content) {
        const assistantMessage: Message = { role: 'assistant', content: response.content };
        setMessages(prev => [...prev, assistantMessage]);
      }

      if (response.tool_results) {
        for (const tr of response.tool_results) {
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
        <div className="header-actions">
          <button className="btn" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      </header>

      <main className="main">
        <aside className="sidebar">
          <div className="sidebar-header">
            <h2>Sessions</h2>
            <button className="btn btn-primary" onClick={createSession}>
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

        <div className="chat-container">
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
    </div>
  );
}

export default App;