import { useState, useEffect, useRef, useCallback } from 'react';

interface Message {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  reasoning?: string;
  files?: FileAttachment[];
}

interface FileAttachment {
  name: string;
  type: string;
  content: string;
  size: number;
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
  const [streamingContent, setStreamingContent] = useState('');
  const [streamingReasoning, setStreamingReasoning] = useState('');
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent, scrollToBottom]);

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
    setStreamingContent('');
    setStreamingReasoning('');
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

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        const attachment: FileAttachment = {
          name: file.name,
          type: file.type,
          content: content,
          size: file.size,
        };
        setAttachments(prev => [...prev, attachment]);
      };
      reader.readAsDataURL(file);
    });

    e.target.value = '';
  }

  function removeAttachment(index: number) {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  }

  async function sendMessage() {
    if ((!input.trim() && attachments.length === 0) || loading || !currentSessionId) return;

    const userMessage: Message = { 
      role: 'user', 
      content: input,
      files: attachments.length > 0 ? attachments : undefined
    };
    const currentMessages = [...messages, userMessage];
    
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setAttachments([]);
    setLoading(true);
    setStreamingContent('');
    setStreamingReasoning('');

    let finalContent = '';
    let finalReasoning = '';

    try {
      const res = await fetch(`${API_BASE}/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          messages: currentMessages,
          sessionId: currentSessionId 
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No reader available');
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value);
        const lines = text.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.type === 'content') {
                finalContent += data.data;
                setStreamingContent(finalContent);
              } else if (data.type === 'reasoning') {
                finalReasoning += data.data;
                setStreamingReasoning(finalReasoning);
              } else if (data.type === 'response_end') {
                if (finalContent || finalReasoning) {
                  const assistantMessage: Message = { 
                    role: 'assistant', 
                    content: finalContent,
                    reasoning: finalReasoning 
                  };
                  setMessages(prev => [...prev, assistantMessage]);
                }
                finalContent = '';
                finalReasoning = '';
                setStreamingContent('');
                setStreamingReasoning('');
              } else if (data.type === 'done') {
                if (finalContent || finalReasoning) {
                  const assistantMessage: Message = { 
                    role: 'assistant', 
                    content: finalContent,
                    reasoning: finalReasoning 
                  };
                  setMessages(prev => [...prev, assistantMessage]);
                }
                setStreamingContent('');
                setStreamingReasoning('');
              } else if (data.type === 'error') {
                setMessages(prev => [...prev, { role: 'assistant', content: `错误: ${data.data}` }]);
              }
            } catch (e) {
              console.error('Parse error:', e);
            }
          }
        }
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
            <img src="https://cruxai.cn/icon/Chat.png" alt="Crux" className="app-title-text" />
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
          {messages.length === 0 && !streamingContent && (
            <div className="welcome-message">我是 Crux，很高兴见到你！</div>
          )}
          
          {messages.map((msg, i) => (
            <div key={i} className={`message ${msg.role === 'user' ? 'user-message' : 'bot-message'}`}>
              <div className="message-content">
                {msg.files && msg.files.length > 0 && (
                  <div className="message-files">
                    {msg.files.map((file, j) => (
                      <div key={j} className="message-file">
                        <span className="file-icon">📄</span>
                        <span className="file-name">{file.name}</span>
                      </div>
                    ))}
                  </div>
                )}
                {msg.reasoning && (
                  <div className="reasoning-box">
                    <div className="reasoning-label">🤔 思考</div>
                    <div className="reasoning-content">{msg.reasoning}</div>
                  </div>
                )}
                <div className="message-text">{msg.content}</div>
              </div>
            </div>
          ))}
          
          {(streamingReasoning || streamingContent) && (
            <div className="message bot-message">
              <div className="message-content">
                {streamingReasoning && (
                  <div className="reasoning-box">
                    <div className="reasoning-label">🤔 思考</div>
                    <div className="reasoning-content">{streamingReasoning}</div>
                  </div>
                )}
                <div className="message-text streaming">{streamingContent}<span className="cursor">▋</span></div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        <div className="input-container">
          {attachments.length > 0 && (
            <div className="attachments-preview">
              {attachments.map((file, i) => (
                <div key={i} className="attachment-item">
                  <span className="attachment-name">{file.name}</span>
                  <button className="attachment-remove" onClick={() => removeAttachment(i)}>×</button>
                </div>
              ))}
            </div>
          )}
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
          <div className="input-buttons">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
            <button 
              className="attach-button" 
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              title="添加附件"
            >
              📎
            </button>
            <button 
              className="send-button" 
              onClick={sendMessage} 
              disabled={loading || (!input.trim() && attachments.length === 0)}
            >
              ➜
            </button>
          </div>
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