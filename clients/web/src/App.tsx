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
  const [showSettings, setShowSettings] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [apiKey, setApiKey] = useState('');
  const [baseURL, setBaseURL] = useState('https://api.deepseek.com/v1');
  const [model, setModel] = useState('deepseek-chat');
  const [temperature, setTemperature] = useState('0.7');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    loadSessions();
    loadConfig();
  }, []);

  async function loadConfig() {
    try {
      const res = await fetch(`${API_BASE}/config`);
      const data = await res.json();
      setApiKey(data.api?.apiKey || '');
      setBaseURL(data.api?.baseURL || 'https://api.deepseek.com/v1');
      setModel(data.api?.model || 'deepseek-chat');
      setTemperature(String(data.api?.temperature || 0.7));
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
        body: JSON.stringify({ name: `新对话 ${new Date().toLocaleString()}` }),
      });
      const session = await res.json();
      await loadSessions();
      selectSession(session.id);
    } catch (e) {
      console.error('Failed to create session:', e);
    }
  }

  async function deleteSession(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await fetch(`${API_BASE}/sessions/${id}`, { method: 'DELETE' });
      if (currentSessionId === id) {
        setCurrentSessionId(null);
        setMessages([]);
      }
      loadSessions();
    } catch (e) {
      console.error('Failed to delete session:', e);
    }
  }

  async function saveConfig() {
    try {
      await fetch(`${API_BASE}/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          apiKey,
          baseURL,
          model,
          temperature: parseFloat(temperature)
        }),
      });
      setShowSettings(false);
    } catch (e) {
      console.error('Failed to save config:', e);
    }
  }

  async function sendMessage() {
    if (!input.trim() || loading || !currentSessionId) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          messages: [...messages, userMessage],
          sessionId: currentSessionId 
        }),
      });

      const data = await res.json();

      if (data.content) {
        const assistantMessage: Message = { role: 'assistant', content: data.content };
        setMessages(prev => [...prev, assistantMessage]);
      }

      if (data.error) {
        setMessages(prev => [...prev, { role: 'assistant', content: `错误: ${data.error}` }]);
      }
    } catch (e) {
      console.error('Failed to send message:', e);
      setMessages(prev => [...prev, { role: 'assistant', content: `错误: ${e}` }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`app ${darkMode ? 'dark-theme' : ''}`}>
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="app-title">
            <img src="https://cruxai.cn/icon/i.png" alt="Crux" className="app-icon" />
            <span>Crux</span>
          </div>
          <div className="app-subtitle">by CZLJ</div>
          <button className="new-chat-btn" onClick={createSession}>+ 新建对话</button>
        </div>

        <div className="conversation-list">
          {sessions.map(session => (
            <div
              key={session.id}
              className={`conversation-item ${session.id === currentSessionId ? 'active' : ''}`}
              onClick={() => selectSession(session.id)}
            >
              <span className="conversation-title">{session.name}</span>
              <span className="delete-btn" onClick={(e) => deleteSession(session.id, e)}>×</span>
            </div>
          ))}
        </div>

        <div className="sidebar-footer">
          <button className="settings-btn" onClick={() => setShowSettings(true)}>
            ⚙️ 设置
          </button>
        </div>
      </aside>

      <main className="chat-container">
        <div className="chat-header">
          <h2 className="chat-title">
            {sessions.find(s => s.id === currentSessionId)?.name || '新对话'}
          </h2>
          <button className="theme-toggle" onClick={() => setDarkMode(!darkMode)}>
            {darkMode ? '☀️' : '🌙'}
          </button>
        </div>

        <div className="chat-messages">
          {messages.length === 0 && (
            <div className="welcome-message">我是 Crux，很高兴见到你！</div>
          )}
          
          {messages.map((msg, i) => (
            <div key={i} className={`message ${msg.role === 'user' ? 'user-message' : 'bot-message'}`}>
              <div className="message-avatar">
                {msg.role === 'user' ? '👤' : '🤖'}
              </div>
              <div className="message-content">
                {msg.content}
              </div>
            </div>
          ))}
          
          {loading && (
            <div className="message bot-message">
              <div className="message-avatar">🤖</div>
              <div className="message-content">
                <span className="loading-dots">思考中<span>.</span><span>.</span><span>.</span></span>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        <div className="input-container">
          <textarea
            className="user-input"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="输入消息... (Enter 发送, Shift+Enter 换行)"
            disabled={loading}
          />
          <button className="send-button" onClick={sendMessage} disabled={loading || !input.trim()}>
            ➜
          </button>
        </div>
      </main>

      {showSettings && (
        <div className="modal-overlay" onClick={() => setShowSettings(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>设置</h2>
            <div className="form-group">
              <label>API Key</label>
              <input
                type="password"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder="sk-..."
              />
            </div>
            <div className="form-group">
              <label>Base URL</label>
              <input
                type="text"
                value={baseURL}
                onChange={e => setBaseURL(e.target.value)}
                placeholder="https://api.deepseek.com/v1"
              />
            </div>
            <div className="form-group">
              <label>Model</label>
              <input
                type="text"
                value={model}
                onChange={e => setModel(e.target.value)}
                placeholder="deepseek-chat"
              />
            </div>
            <div className="form-group">
              <label>Temperature</label>
              <input
                type="text"
                value={temperature}
                onChange={e => setTemperature(e.target.value)}
                placeholder="0.7"
              />
            </div>
            <div className="modal-actions">
              <button className="cancel-btn" onClick={() => setShowSettings(false)}>取消</button>
              <button className="save-btn" onClick={saveConfig}>保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;