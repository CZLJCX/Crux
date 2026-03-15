import { useState, useEffect, useRef, useCallback } from 'react';
import { MarkdownRenderer } from './components/MarkdownRenderer';

interface ToolCallInfo {
  name: string;
  args: string;
  result?: string;
  status: 'pending' | 'running' | 'done' | 'error';
}

interface Message {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  reasoning?: string;
  files?: FileAttachment[];
  toolCalls?: ToolCallInfo[];
}

interface FileAttachment {
  name: string;
  type: string;
  content: string;
  size: number;
}

const API_BASE = '/api';
const SESSION_ID = 'default-session';

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [baseURL, setBaseURL] = useState('https://api.deepseek.com/v1');
  const [model, setModel] = useState('deepseek-chat');
  const [temperature, setTemperature] = useState('0.7');
  const [streamingContent, setStreamingContent] = useState('');
  const [streamingReasoning, setStreamingReasoning] = useState('');
  const [streamingToolCalls, setStreamingToolCalls] = useState<ToolCallInfo[]>([]);
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent, scrollToBottom]);

  useEffect(() => {
    loadSession();
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

  async function loadSession() {
    try {
      const res = await fetch(`${API_BASE}/sessions/${SESSION_ID}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      } else {
        await fetch(`${API_BASE}/sessions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: SESSION_ID, name: 'Crux Chat' }),
        });
        setMessages([]);
      }
    } catch (e) {
      console.error('Failed to load session:', e);
      setMessages([]);
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
    if ((!input.trim() && attachments.length === 0) || loading) return;

    const userContent = input;
    const userFiles = attachments.length > 0 ? [...attachments] : undefined;
    
    const userMessage: Message = { 
      role: 'user', 
      content: userContent,
      files: userFiles
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setAttachments([]);
    setLoading(true);
    setStreamingContent('');
    setStreamingReasoning('');
    setStreamingToolCalls([]);

    try {
      const res = await fetch(`${API_BASE}/chat/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          content: userContent,
          files: userFiles,
          sessionId: SESSION_ID 
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

      let finalContent = '';
      let finalReasoning = '';
      let currentToolCalls: ToolCallInfo[] = [];

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
              } else if (data.type === 'tool_call') {
                try {
                  const tc = JSON.parse(data.data);
                  currentToolCalls.push({
                    name: tc.function?.name || 'unknown',
                    args: tc.function?.arguments || '{}',
                    status: 'running'
                  });
                  setStreamingToolCalls([...currentToolCalls]);
                } catch (e) {
                  console.error('Parse tool_call error:', e);
                }
              } else if (data.type === 'tool_result') {
                if (currentToolCalls.length > 0) {
                  const lastTool = currentToolCalls[currentToolCalls.length - 1];
                  lastTool.result = data.data;
                  lastTool.status = 'done';
                  setStreamingToolCalls([...currentToolCalls]);
                }
              } else if (data.type === 'response_end' || data.type === 'done') {
                if (finalContent || finalReasoning || currentToolCalls.length > 0) {
                  const assistantMessage: Message = { 
                    role: 'assistant', 
                    content: finalContent,
                    reasoning: finalReasoning,
                    toolCalls: currentToolCalls.length > 0 ? [...currentToolCalls] : undefined
                  };
                  setMessages(prev => [...prev, assistantMessage]);
                }
                finalContent = '';
                finalReasoning = '';
                currentToolCalls = [];
                setStreamingContent('');
                setStreamingReasoning('');
                setStreamingToolCalls([]);
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const hasMessages = messages.length > 0 || streamingContent || streamingReasoning || streamingToolCalls.length > 0;

  return (
    <div className={`app ${darkMode ? 'dark-theme' : ''}`}>
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="app-title">
            <img src="https://cruxai.cn/icon/i.png" alt="Crux" className="app-icon" />
            <img src="https://cruxai.cn/icon/Chat.png" alt="Crux" className="app-title-text" />
          </div>
          <div className="app-subtitle">by CZLJ</div>
        </div>

        <div className="sidebar-footer">
          <button className="theme-toggle" onClick={() => setDarkMode(!darkMode)}>
            {darkMode ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="5"/>
                <line x1="12" y1="1" x2="12" y2="3"/>
                <line x1="12" y1="21" x2="12" y2="23"/>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                <line x1="1" y1="12" x2="3" y2="12"/>
                <line x1="21" y1="12" x2="23" y2="12"/>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
              </svg>
            )}
            {darkMode ? '浅色模式' : '深色模式'}
          </button>
          <button className="settings-btn" onClick={() => setShowSettings(true)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
            设置
          </button>
        </div>
      </aside>

      <main className="chat-container">
        {hasMessages ? (
          <>
            <div className="chat-messages">
              {messages.map((msg, i) => (
                <div key={i} className={`message ${msg.role === 'user' ? 'user-message' : 'assistant-message'}`}>
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
                        <div className="reasoning-label">💭 思考过程</div>
                        <div className="reasoning-content">{msg.reasoning}</div>
                      </div>
                    )}
                    {msg.toolCalls && msg.toolCalls.length > 0 && (
                      <div className="tool-calls-box">
                        <div className="tool-calls-label">🔧 工具调用</div>
                        {msg.toolCalls.map((tc, j) => (
                          <div key={j} className="tool-call-item">
                            <div className="tool-call-header">
                              <span className="tool-name">{tc.name}</span>
                              <span className={`tool-status ${tc.status}`}>{tc.status === 'done' ? '✓' : '⏳'}</span>
                            </div>
                            {tc.result && (
                              <pre className="tool-result">{tc.result}</pre>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="message-text"><MarkdownRenderer content={msg.content} darkMode={darkMode} /></div>
                  </div>
                </div>
              ))}
              
              {(streamingReasoning || streamingContent || streamingToolCalls.length > 0) && (
                <div className="message assistant-message">
                  <div className="message-content">
                    {streamingReasoning && (
                      <div className="reasoning-box">
                        <div className="reasoning-label">💭 思考过程</div>
                        <div className="reasoning-content">{streamingReasoning}</div>
                      </div>
                    )}
                    {streamingToolCalls.length > 0 && (
                      <div className="tool-calls-box">
                        <div className="tool-calls-label">🔧 工具调用</div>
                        {streamingToolCalls.map((tc, j) => (
                          <div key={j} className="tool-call-item">
                            <div className="tool-call-header">
                              <span className="tool-name">{tc.name}</span>
                              <span className={`tool-status ${tc.status}`}>{tc.status === 'done' ? '✓' : '⏳'}</span>
                            </div>
                            {tc.result && (
                              <pre className="tool-result">{tc.result}</pre>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="message-text streaming"><MarkdownRenderer content={streamingContent} darkMode={darkMode} /><span className="cursor">▋</span></div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>

            <div className="input-area">
              <div className="input-wrapper">
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
                <div className="input-box">
                  <textarea
                    ref={inputRef}
                    className="user-input"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="给 Crux 发送消息..."
                    disabled={loading}
                    rows={1}
                  />
                  <div className="input-actions">
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      onChange={handleFileSelect}
                      style={{ display: 'none' }}
                    />
                    <button 
                      className="attach-btn" 
                      onClick={() => fileInputRef.current?.click()}
                      disabled={loading}
                      title="添加附件"
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
                      </svg>
                    </button>
                    <button 
                      className="send-btn" 
                      onClick={sendMessage} 
                      disabled={loading || (!input.trim() && attachments.length === 0)}
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"></path>
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="welcome-screen">
            <div className="welcome-content">
              <div className="welcome-logo">
                <img src="https://cruxai.cn/icon/i.png" alt="Crux" className="welcome-icon" />
                <img src="https://cruxai.cn/icon/Chat.png" alt="Crux" className="welcome-title-img" />
              </div>
              <h1 className="welcome-title">今天我能帮你什么？</h1>
              <p className="welcome-subtitle">我是 Crux，你的 AI 助手</p>
              
              <div className="center-input-wrapper">
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
                <div className="input-box centered">
                  <textarea
                    ref={inputRef}
                    className="user-input large"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="输入你的问题..."
                    disabled={loading}
                    rows={1}
                  />
                  <div className="input-actions">
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      onChange={handleFileSelect}
                      style={{ display: 'none' }}
                    />
                    <button 
                      className="attach-btn" 
                      onClick={() => fileInputRef.current?.click()}
                      disabled={loading}
                      title="添加附件"
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
                      </svg>
                    </button>
                    <button 
                      className="send-btn" 
                      onClick={sendMessage} 
                      disabled={loading || (!input.trim() && attachments.length === 0)}
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"></path>
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
            
            <button className="theme-toggle-floating" onClick={() => setDarkMode(!darkMode)}>
              {darkMode ? '☀️' : '🌙'}
            </button>
          </div>
        )}
      </main>

      {showSettings && (
        <div className="modal-overlay" onClick={() => setShowSettings(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>设置</h2>
              <button className="modal-close" onClick={() => setShowSettings(false)}>×</button>
            </div>
            <div className="modal-body">
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