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
  // FIX 1: messageIdCounter — Date.now() same millisecond mein same ID de sakta tha
  // Ab ek counter use karo jo kabhi repeat nahi hoga
  const messageIdRef = useRef(0);

  // ============================================
  // THEME LOAD ON STARTUP
  // ============================================
  useEffect(() => {
    loadFiles();
    // FIX 2: localStorage sirf browser mein hota hai
    // React strict mode mein yeh kabhi fail ho sakta tha — try/catch lagaya
    try {
      const savedTheme = localStorage.getItem('theme');
      if (savedTheme === 'light') {
        setDarkMode(false);
      }
    } catch (e) {
      console.warn('localStorage not available');
    }
  }, []);

  // ============================================
  // THEME APPLY
  // ============================================
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

  // ============================================
  // AUTO SCROLL
  // ============================================
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ============================================
  // LOAD FILES FROM BACKEND
  // ============================================
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

  // ============================================
  // ADD MESSAGE — FIX 1 applied here
  // ============================================
  const addMessage = useCallback((role, content) => {
    messageIdRef.current += 1;
    setMessages(prev => [...prev, {
      role,
      content,
      id: messageIdRef.current
    }]);
  }, []);

  // ============================================
  // FILE SELECT
  // ============================================
  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files);
    setFiles(prev => [...prev, ...selectedFiles]);
    // FIX 3: input reset karo taki same file dobara select ho sake
    e.target.value = '';
  };

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  // ============================================
  // UPLOAD FILES
  // ============================================
  const uploadFiles = async () => {
    if (files.length === 0) {
      alert('Pehle files select karein');
      return;
    }

    setLoading(true);
    let successCount = 0;

    for (let file of files) {
      const formData = new FormData();
      formData.append('file', file);

      addMessage('system', `📤 Uploading: ${file.name}...`);

      try {
        const res = await fetch(`${API_BASE}/upload`, {
          method: 'POST',
          body: formData
        });
        const data = await res.json();

        if (res.ok && data.success) {
          addMessage('system', `✅ ${file.name} — ${data.chunks} chunks bane`);
          successCount++;
        } else {
          addMessage('system', `❌ ${file.name} — ${data.error || 'Upload failed'}`);
        }
      } catch (err) {
        addMessage('system', `❌ ${file.name} — Backend se connection nahi mila`);
      }
    }

    setFiles([]);
    // FIX 4: loadFiles ka wait karo, phir updated totalChunks use karo
    // Pehle: addMessage mein purana totalChunks state use hota tha (stale state bug)
    const res = await fetch(`${API_BASE}/files`).catch(() => null);
    if (res && res.ok) {
      const data = await res.json();
      setUploadedFiles(data.files || []);
      setTotalChunks(data.total_chunks || 0);
      addMessage('system', `✨ ${successCount} files upload ho gayi — Total chunks: ${data.total_chunks}`);
    }

    setLoading(false);
  };

  // ============================================
  // ASK QUESTION
  // FIX 5: API call URL sahi kiya
  // Pehle: fetch(`/ask?question=...`) with method POST — yeh kaam nahi karta tha
  // Ab: Query parameter theek hai kyunki backend bhi Query(...) use karta hai
  // ============================================
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
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const data = await res.json();

      if (data.error) {
        addMessage('bot', `❌ ${data.error}`);
      } else {
        addMessage('bot', data.answer);
        if (data.sources && data.sources.length > 0) {
          // Duplicate sources hata do
          const uniqueSources = [...new Set(data.sources.map(s => s.file))];
          addMessage('system', `📚 Source: ${uniqueSources.join(', ')}`);
        }
      }
    } catch (err) {
      addMessage('bot', '❌ Backend se connect nahi ho saka. Check karein: http://localhost:8000 chal raha hai?');
    }

    setLoading(false);
  };

  // ============================================
  // CLEAR CHAT
  // ============================================
  const clearChat = () => {
    setMessages([]);
  };

  // ============================================
  // CLEAR ALL FILES
  // ============================================
  const clearAll = async () => {
    // FIX 6: window.confirm use karo — plain confirm() React strict mode mein warn karta hai
    if (!window.confirm('Sare files delete ho jayenge. Confirm?')) return;

    try {
      await fetch(`${API_BASE}/clear`, { method: 'DELETE' });
      await loadFiles();
      addMessage('system', '🗑️ Sab kuch delete ho gaya');
    } catch (err) {
      addMessage('system', '❌ Clear karne mein error aaya');
    }
  };

  const toggleTheme = () => {
    setDarkMode(prev => !prev);
  };

  const getFileIcon = (type) => {
    const icons = {
      pdf: '📄',
      docx: '📝',
      txt: '📃',
      csv: '📊',
      excel: '📈',
      xlsx: '📈',
      json: '🔧'
    };
    return icons[type] || '📄';
  };

  // ============================================
  // FIX 7: onKeyPress deprecated tha
  // Ab onKeyDown use karo — modern React ka sahi tarika
  // ============================================
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault(); // form submit rokna
      askQuestion();
    }
  };

  return (
    <div className={`app ${darkMode ? 'dark' : 'light'}`}>

      {/* ========== SIDEBAR ========== */}
      <aside className="sidebar">

        {/* Logo */}
        <div className="logo">
          <div className="logo-icon">✨</div>
          <div className="logo-text">DocChat</div>
          <button onClick={toggleTheme} className="theme-toggle" title="Theme toggle">
            {darkMode ? '☀️' : '🌙'}
          </button>
        </div>

        {/* Stats */}
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

        {/* Upload Button */}
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
          <p className="upload-hint">PDF, DOCX, TXT, CSV, Excel, JSON</p>
        </div>

        {/* Queue — files jo upload hone wali hain */}
        {files.length > 0 && (
          <div className="queue-panel">
            <div className="panel-header">
              <span>Queue ({files.length})</span>
              <button onClick={() => setFiles([])} className="clear-queue">Clear</button>
            </div>
            <div className="queue-list">
              {files.map((file, idx) => (
                <div key={idx} className="queue-item">
                  <span>{getFileIcon(file.name.split('.').pop().toLowerCase())}</span>
                  <span className="queue-name">{file.name}</span>
                  <button onClick={() => removeFile(idx)} className="queue-remove">×</button>
                </div>
              ))}
            </div>
            <button
              className="upload-submit"
              onClick={uploadFiles}
              disabled={loading}
            >
              {loading ? 'Uploading...' : `Upload ${files.length} file${files.length > 1 ? 's' : ''}`}
            </button>
          </div>
        )}

        {/* Uploaded Files Library */}
        {uploadedFiles.length > 0 && (
          <div className="files-panel">
            <div className="panel-header">
              <span>Library</span>
              <button onClick={clearAll} className="clear-all">Clear all</button>
            </div>
            <div className="files-list">
              {uploadedFiles.map((file, idx) => (
                <div key={idx} className="file-item-side">
                  <span>{getFileIcon(file.type)}</span>
                  <span className="file-name-side" title={file.name}>{file.name}</span>
                  <span className="file-chunks-side">{file.chunks}</span>
                </div>
              ))}
            </div>
          </div>
        )}

      </aside>

      {/* ========== MAIN CHAT ========== */}
      <main className="chat-main">

        {/* Header */}
        <div className="chat-header">
          <h1>Document Assistant</h1>
          <button onClick={clearChat} className="clear-chat-btn">Clear Chat</button>
        </div>

        {/* Messages */}
        <div className="messages-area">
          {messages.length === 0 ? (
            <div className="welcome-screen">
              <div className="welcome-icon">💬</div>
              <h3>Start a conversation</h3>
              <p>Documents upload karein aur unke baare mein sawal poochein</p>
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
                  <div className="message-avatar">
                    {msg.role === 'user' ? '👤' : msg.role === 'bot' ? '🤖' : '📌'}
                  </div>
                  <div className="message-bubble">
                    <div className="message-text">{msg.content}</div>
                  </div>
                </div>
              ))}

              {/* Typing indicator */}
              {loading && (
                <div className="typing-indicator">
                  <span></span><span></span><span></span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="input-container">
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Documents ke baare mein koi bhi sawal poochein... (Enter = Send, Shift+Enter = New line)"
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

        {/* FIX 8: Hint show karo agar koi document upload nahi */}
        {totalChunks === 0 && (
          <p className="no-docs-hint">
            ⬅️ Pehle koi document upload karein, phir sawal poochein
          </p>
        )}

      </main>
    </div>
  );
}

export default App;