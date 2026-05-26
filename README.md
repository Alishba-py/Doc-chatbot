# RAG Chatbot - Complete Setup

## 🚀 Quick Start (5 minutes)

### Prerequisites

- Python 3.9+
- Node.js 16+
- Ollama (for EXE/local mode)

### Installation

1. **Run installation script:**
2. **Start Backend:**
3. **Start Frontend (new terminal):**
4. **Open browser:**


## 📁 Project Structure

RAG_Chatbot_Final/
├── backend/ # Python backend (FastAPI)
├── frontend/ # React frontend
├── scripts/ # Helper scripts
├── data/ # Uploaded PDFs
├── vectors/ # FAISS indices
└── dist/ # EXE builds


## 🔧 Modes

### Desktop Mode (EXE)

- No internet required after setup
- Uses local Ollama
- Build: `scripts/build_exe.bat`

### Cloud Mode (Hosting)

- Requires internet
- Uses Groq API (free)
- Deploy to Render/Vercel

## 📝 API Endpoints

| Endpoint        | Method | Description      |
| --------------- | ------ | ---------------- |
| `/`           | GET    | Status           |
| `/upload`     | POST   | Upload PDF       |
| `/ask`        | POST   | Ask question     |
| `/ask/stream` | GET    | Streaming answer |
| `/health`     | GET    | Health check     |

## 🎯 Usage

1. Upload a PDF document
2. Ask questions about the content
3. Get instant AI answers with sources

## 🆓 Free Services Used

- **Ollama** - Local LLM (100% free)
- **Groq** - Cloud LLM (free tier)
- **Sentence Transformers** - Embeddings (free)
- **FAISS** - Vector search (free)

## 📞 Support

For issues, check:

- Backend running on port 8000
- Ollama installed: `ollama --version`
- Model pulled: `ollama list`

---

**Made with ❤️ for production RAG chatbots**
