import React, { useState, useRef, useEffect, useCallback } from 'react';
import './App.css';

const API_BASE = 'http://localhost:8000';

function App() {
  const [files, setFiles] = useState([]);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [totalChunks, setTotalChunks] = useState(0);
  const [darkMode, setDarkMode] = useState(true);
  const messagesEndRef = useRef(null);
  const messageIdRef = useRef(0);

  useEffect(() => {
    loadFiles();
    try {
      const savedTheme = localStorage.getItem('theme');
      if (savedTheme === 'light') setDarkMode(false);
    } catch (e) {}
  }, []);

  useEffect(() => {
    if (darkMode) {
      document.body.classList.add('dark-theme');
      document.body.classList.remove('light-theme');
    } else {
      document.body.classList.add('light-theme');
      document.body.classList.remove('dark-theme');
    }
    try {
      localStorage.setItem('theme', darkMode ? 'dark' : 'light');
    } catch (e) {}
  }, [darkMode]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadFiles = async () => {
    try {
      const res = await fetch(`${API_BASE}/files`);
      if (!res.ok) throw new Error('Server error');
      const data = await res.json();
      setUploadedFiles(data.files || []);
      setTotalChunks(data.total_chunks || 0);
    } catch (err) {
      console.error('Could not load files:', err);
    }
  };

  const addMessage = useCallback((role, content) => {
    messageIdRef.current += 1;
    setMessages(prev => [...prev, { role, content, id: messageIdRef.current }]);
  }, []);

  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files);
    setFiles(prev => [...prev, ...selectedFiles]);
    e.target.value = '';
  };

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const uploadFiles = async () => {
    if (files.length === 0) {
      alert('Please select files first');
      return;
    }
    setLoading(true);
    let successCount = 0;

    for (let file of files) {
      const formData = new FormData();
      formData.append('file', file);
      addMessage('system', `Uploading: ${file.name}...`);
      try {
        const res = await fetch(`${API_BASE}/upload`, {
          method: 'POST',
          body: formData
        });
        const data = await res.json();
        if (res.ok && data.success) {
          addMessage('system', `Uploaded: ${file.name} — ${data.chunks} chunks processed`);
          successCount++;
        } else {
          addMessage('system', `Failed: ${file.name} — ${data.error || 'Upload error'}`);
        }
      } catch (err) {
        addMessage('system', `Failed: ${file.name} — Could not connect to backend`);
      }
    }

    setFiles([]);
    const res = await fetch(`${API_BASE}/files`).catch(() => null);
    if (res && res.ok) {
      const data = await res.json();
      setUploadedFiles(data.files || []);
      setTotalChunks(data.total_chunks || 0);
      addMessage('system', `${successCount} file${successCount > 1 ? 's' : ''} ready. Total chunks: ${data.total_chunks}`);
    }
    setLoading(false);
  };

  const askQuestion = async () => {
    if (!question.trim()) return;
    if (loading) return;

    const userQuestion = question.trim();
    setQuestion('');
    addMessage('user', userQuestion);
    setLoading(true);

    try {
      const url = `${API_BASE}/ask?question=${encodeURIComponent(userQuestion)}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (data.error) {
        addMessage('bot', `Error: ${data.error}`);
      } else {
        addMessage('bot', data.answer);
        if (data.sources && data.sources.length > 0) {
          const uniqueSources = [...new Set(data.sources.map(s => s.file))];
          addMessage('system', `Source: ${uniqueSources.join(', ')}`);
        }
      }
    } catch (err) {
      addMessage('bot', 'Could not connect to backend. Please check if the server is running at http://localhost:8000');
    }
    setLoading(false);
  };

  const clearChat = () => setMessages([]);

  const clearAll = async () => {
    if (!window.confirm('Delete all uploaded files? This cannot be undone.')) return;
    try {
      await fetch(`${API_BASE}/clear`, { method: 'DELETE' });
      await loadFiles();
      addMessage('system', 'All files have been deleted.');
    } catch (err) {
      addMessage('system', 'Error while clearing files.');
    }
  };

  const toggleTheme = () => setDarkMode(prev => !prev);

  const getFileBadge = (type) => {
    const labels = {
      pdf: '📄', docx: '📝', txt: '📃',
      csv: '📊', excel: '📈', xlsx: '📈', json: '🔧'
    };
    return labels[type] || '📄';
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      askQuestion();
    }
  };

  return (
    <div className={`app ${darkMode ? 'dark' : 'light'}`}>

      {/* SIDEBAR */}
      <aside className="sidebar">

        <div className="logo">
          <div className="logo-text">DocChat</div>
          <button onClick={toggleTheme} className="theme-toggle">
            {darkMode ? 'Light' : 'Dark'}
          </button>
        </div>

        <div className="stats-panel">
          <div className="stat-item">
            <span className="stat-label">Documents</span>
            <span className="stat-value">{uploadedFiles.length}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Chunks</span>
            <span className="stat-value">{totalChunks}</span>
          </div>
        </div>

        <div className="upload-panel">
          <input
            type="file"
            accept=".pdf,.docx,.txt,.csv,.xlsx,.xls,.json"
            onChange={handleFileSelect}
            multiple
            id="file-input"
            hidden
          />
          <label htmlFor="file-input" className="upload-btn">
            + Upload Files
          </label>
          <p className="upload-hint">Supported: PDF, DOCX, TXT, CSV, Excel, JSON</p>
        </div>

        {files.length > 0 && (
          <div className="queue-panel">
            <div className="panel-header">
              <span>Queue ({files.length})</span>
              <button onClick={() => setFiles([])} className="clear-queue">Clear</button>
            </div>
            <div className="queue-list">
              {files.map((file, idx) => (
                <div key={idx} className="queue-item">
                  <span className="file-type-badge">
                    {getFileBadge(file.name.split('.').pop().toLowerCase())}
                  </span>
                  <span className="queue-name">{file.name}</span>
                  <button onClick={() => removeFile(idx)} className="queue-remove">x</button>
                </div>
              ))}
            </div>
            <button className="upload-submit" onClick={uploadFiles} disabled={loading}>
              {loading ? 'Uploading...' : `Upload ${files.length} file${files.length > 1 ? 's' : ''}`}
            </button>
          </div>
        )}

        {uploadedFiles.length > 0 && (
          <div className="files-panel">
            <div className="panel-header">
              <span>Library</span>
              <button onClick={clearAll} className="clear-all">Clear All</button>
            </div>
            <div className="files-list">
              {uploadedFiles.map((file, idx) => (
                <div key={idx} className="file-item-side">
                  <span className="file-type-badge">{getFileBadge(file.type)}</span>
                  <span className="file-name-side" title={file.name}>{file.name}</span>
                  <span className="file-chunks-side">{file.chunks}</span>
                </div>
              ))}
            </div>
          </div>
        )}

      </aside>

      {/* MAIN CHAT */}
      <main className="chat-main">

        <div className="chat-header">
          <h1>Document Assistant</h1>
          <button onClick={clearChat} className="clear-chat-btn">Clear Chat</button>
        </div>

        <div className="messages-area">
          {messages.length === 0 ? (
            <div className="welcome-screen">
              <div className="welcome-icon">💬</div>
              <h3>Hello! I am your Document Assistant</h3>
              <p>Upload your documents and ask me anything about them</p>
              <div className="suggestions">
                <button onClick={() => setQuestion('Summarize this document')}>
                  Summarize document
                </button>
                <button onClick={() => setQuestion('What are the key points?')}>
                  Key points
                </button>
                <button onClick={() => setQuestion('List all important information')}>
                  Important info
                </button>
              </div>
            </div>
          ) : (
            <div className="messages-list">
              {messages.map((msg) => (
                <div key={msg.id} className={`message-card ${msg.role}`}>

                  {/* AVATAR - ONLY ICONS, NO IMAGES */}
                  <div className="message-avatar">
                    {msg.role === 'user' ? (
                      <div className="avatar-circle user-avatar">👤</div>
                    ) : msg.role === 'bot' ? (
                      <div className="avatar-circle bot-avatar">🤖</div>
                    ) : (
                      <div className="avatar-circle system-avatar">ℹ️</div>
                    )}
                  </div>

                  <div className="message-bubble">
                    <div className="message-text">{msg.content}</div>
                  </div>
                </div>
              ))}

              {loading && (
                <div className="typing-indicator">
                  <span></span><span></span><span></span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        <div className="input-container">
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question about your documents... (Enter to send, Shift+Enter for new line)"
            rows="2"
            disabled={loading}
          />
          <button
            onClick={askQuestion}
            disabled={loading || totalChunks === 0 || !question.trim()}
          >
            {loading ? '...' : 'Send'}
          </button>
        </div>

        {totalChunks === 0 && (
          <p className="no-docs-hint">
            📁 Please upload a document first, then ask your question.
          </p>
        )}

      </main>
    </div>
  );
}

export default App;