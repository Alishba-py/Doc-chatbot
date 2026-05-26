import os
import sys
import shutil
import json
import numpy as np
import faiss
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from sentence_transformers import SentenceTransformer
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================
# SETUP - Folders banana
# ============================================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
VECTORS_DIR = os.path.join(BASE_DIR, "vectors")
FAISS_INDEX_PATH = os.path.join(VECTORS_DIR, "index.faiss")
METADATA_PATH = os.path.join(VECTORS_DIR, "chunks_metadata.json")

os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(VECTORS_DIR, exist_ok=True)

# ============================================
# LOAD EMBEDDING MODEL
# ============================================
print("📥 Loading embedding model...")
embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
print("✅ Model loaded")

# ============================================
# GLOBAL VARIABLES
# ============================================
all_chunks = []
all_sources = []
faiss_index = None

# ============================================
# FIX 1: STARTUP PE SAVED INDEX LOAD KARO
# Pehle yeh nahi tha — server restart pe sab kho jaata tha
# ============================================
def load_existing_index():
    global all_chunks, all_sources, faiss_index
    if os.path.exists(FAISS_INDEX_PATH) and os.path.exists(METADATA_PATH):
        try:
            faiss_index = faiss.read_index(FAISS_INDEX_PATH)
            with open(METADATA_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
            all_chunks = data.get("chunks", [])
            all_sources = data.get("sources", [])
            print(f"✅ Loaded existing index: {len(all_chunks)} chunks from {FAISS_INDEX_PATH}")
        except Exception as e:
            print(f"⚠️ Could not load existing index: {e}")
    else:
        print("ℹ️ No existing index found, starting fresh")

load_existing_index()

# ============================================
# FIX 2: INDEX SAVE KARNE KA FUNCTION
# Pehle yeh bilkul nahi tha
# ============================================
def save_index():
    global all_chunks, all_sources, faiss_index
    try:
        if faiss_index is not None:
            faiss.write_index(faiss_index, FAISS_INDEX_PATH)
        metadata = {"chunks": all_chunks, "sources": all_sources}
        with open(METADATA_PATH, "w", encoding="utf-8") as f:
            json.dump(metadata, f, ensure_ascii=False, indent=2)
        print(f"💾 Index saved: {len(all_chunks)} chunks")
    except Exception as e:
        print(f"⚠️ Could not save index: {e}")

# ============================================
# DOCUMENT PROCESSORS
# ============================================

def extract_pdf(file_path):
    """Extract text from PDF"""
    try:
        from pypdf import PdfReader
        reader = PdfReader(file_path)
        text = ""
        for page in reader.pages:
            page_text = page.extract_text()
            if page_text:
                text += page_text + "\n"
        return text
    except Exception as e:
        print(f"PDF error: {e}")
        return ""

# FIX 3: extract_docx mein correct import
# Pehle: import docx → kabhi kabhi kaam nahi karta tha
# Ab: from docx import Document → yeh reliable hai
def extract_docx(file_path):
    """Extract text from DOCX"""
    try:
        from docx import Document
        doc = Document(file_path)
        text = ""
        for para in doc.paragraphs:
            if para.text.strip():
                text += para.text + "\n"
        return text
    except Exception as e:
        print(f"DOCX error: {e}")
        return ""

def extract_txt(file_path):
    """Extract text from TXT"""
    try:
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            return f.read()
    except Exception as e:
        print(f"TXT error: {e}")
        return ""

def extract_csv(file_path):
    """Extract text from CSV"""
    try:
        import pandas as pd
        df = pd.read_csv(file_path)
        text = ""
        for idx, row in df.iterrows():
            text += f"Row {idx+1}: "
            for col in df.columns:
                text += f"{col} = {row[col]}, "
            text += "\n"
        return text
    except Exception as e:
        print(f"CSV error: {e}")
        return ""

def extract_excel(file_path):
    """Extract text from Excel"""
    try:
        import pandas as pd
        df = pd.read_excel(file_path)
        text = ""
        for idx, row in df.iterrows():
            text += f"Row {idx+1}: "
            for col in df.columns:
                text += f"{col} = {row[col]}, "
            text += "\n"
        return text
    except Exception as e:
        print(f"Excel error: {e}")
        return ""

def extract_json(file_path):
    """Extract text from JSON"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return json.dumps(data, indent=2)
    except Exception as e:
        print(f"JSON error: {e}")
        return ""

# FIX 4: chunk_text word-based kiya
# Pehle: character se kaatta tha → words beech mein cut ho jaate the
# Ab: words split karta hai → clean chunks bante hain
def chunk_text(text, chunk_size=150, overlap=20):
    """
    Split text into word-based chunks.
    chunk_size = number of words per chunk (150 words ≈ 500 characters)
    overlap = kitne words repeat honge next chunk mein
    """
    words = text.split()
    chunks = []
    step = chunk_size - overlap  # kitna aage badhe har iteration mein

    for i in range(0, len(words), step):
        chunk_words = words[i:i + chunk_size]
        chunk = " ".join(chunk_words)
        if chunk.strip():
            chunks.append(chunk)

    return chunks

# ============================================
# LLM SETUP (GROQ)
# ============================================
from groq import Groq

API_KEY = os.getenv("GROQ_API_KEY")

if not API_KEY:
    print("⚠️ GROQ_API_KEY not found in .env file!")
    def get_answer(prompt):
        return "❌ Please set GROQ_API_KEY in your .env file"
else:
    groq_client = Groq(api_key=API_KEY)
    print("✅ Groq API ready")

    def get_answer(prompt):
        try:
            completion = groq_client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.5,
                max_tokens=500
            )
            return completion.choices[0].message.content
        except Exception as e:
            return f"❌ Groq API Error: {e}"

# ============================================
# API ENDPOINTS
# ============================================

@app.get("/")
async def root():
    return {
        "name": "Document Chatbot",
        "status": "running",
        "total_chunks": len(all_chunks),
        "total_files": len(set([s.get("file", "") for s in all_sources]))
    }


@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    global all_chunks, all_sources, faiss_index

    filename = file.filename
    ext = os.path.splitext(filename)[1].lower()

    print(f"📥 Uploading: {filename} (Type: {ext})")

    # File save karo
    file_path = os.path.join(DATA_DIR, filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # File type ke hisaab se text extract karo
    text = ""
    file_type = "unknown"

    if ext == '.pdf':
        text = extract_pdf(file_path)
        file_type = "pdf"
    elif ext == '.docx':
        text = extract_docx(file_path)
        file_type = "docx"
    elif ext == '.txt':
        text = extract_txt(file_path)
        file_type = "txt"
    elif ext == '.csv':
        text = extract_csv(file_path)
        file_type = "csv"
    elif ext in ['.xlsx', '.xls']:
        text = extract_excel(file_path)
        file_type = "excel"
    elif ext == '.json':
        text = extract_json(file_path)
        file_type = "json"
    else:
        return {"error": f"Unsupported file type: {ext}. Supported: PDF, DOCX, TXT, CSV, Excel, JSON"}

    if not text or not text.strip():
        return {"error": f"No text could be extracted from {filename}. File might be empty or corrupted."}

    # Chunks banao
    chunks = chunk_text(text)

    if not chunks:
        return {"error": "No chunks created. Text might be too short."}

    print(f"✅ Created {len(chunks)} chunks from {filename}")

    # Chunks aur sources store karo
    start_idx = len(all_chunks)
    for i, chunk in enumerate(chunks):
        all_chunks.append(chunk)
        all_sources.append({
            "file": filename,
            "type": file_type,
            "chunk_index": start_idx + i
        })

    # Embeddings banao
    embeddings = embedding_model.encode(chunks)

    # FAISS index update karo
    if faiss_index is None:
        dimension = embeddings.shape[1]
        faiss_index = faiss.IndexFlatL2(dimension)

    faiss_index.add(embeddings.astype('float32'))

    # FIX 5: Index disk pe save karo taki restart pe kho na jaye
    save_index()

    return {
        "success": True,
        "message": "File uploaded successfully!",
        "filename": filename,
        "type": file_type,
        "chunks": len(chunks),
        "total_chunks": len(all_chunks)
    }


# FIX 6: /ask endpoint — question ab Query parameter se aata hai
# Pehle: question: str directly parameter mein tha — POST mein kaam nahi karta
# Ab: from fastapi import Query use kiya — bilkul sahi tarika
from fastapi import Query

@app.post("/ask")
async def ask_question(question: str = Query(..., description="Apna sawal yahan likhein")):
    global all_chunks, faiss_index, all_sources

    if not question or not question.strip():
        return {"error": "Question cannot be empty."}

    if len(all_chunks) == 0:
        return {"error": "No documents uploaded. Please upload a file first."}

    if faiss_index is None:
        return {"error": "No index found. Please upload a file."}

    # Question ki embedding banao
    question_embedding = embedding_model.encode([question])

    # FAISS mein search karo
    k = min(5, len(all_chunks))
    distances, indices = faiss_index.search(question_embedding.astype('float32'), k)

    # Relevant chunks nikalo
    relevant_chunks = []
    sources = []
    for idx in indices[0]:
        if 0 <= idx < len(all_chunks):
            relevant_chunks.append(all_chunks[idx])
            if idx < len(all_sources):
                sources.append(all_sources[idx])

    if not relevant_chunks:
        return {"error": "No relevant information found in uploaded documents."}

    context = "\n\n---\n\n".join(relevant_chunks)

    prompt = f"""You are a helpful assistant. Answer the question based ONLY on the context provided below.
If the answer is not in the context, say "I couldn't find this information in the uploaded documents."

Context:
{context}

Question: {question}

Answer clearly and concisely:"""

    try:
        answer = get_answer(prompt)
    except Exception as e:
        answer = f"Error getting answer: {e}"

    return {
        "question": question,
        "answer": answer,
        "sources": [{"file": s["file"], "type": s["type"]} for s in sources],
        "total_chunks": len(all_chunks)
    }


@app.get("/files")
async def get_files():
    """Uploaded files ki list"""
    files_dict = {}
    for source in all_sources:
        filename = source["file"]
        if filename not in files_dict:
            files_dict[filename] = {
                "name": filename,
                "type": source["type"],
                "chunks": 0
            }
        files_dict[filename]["chunks"] += 1

    return {
        "files": list(files_dict.values()),
        "total_files": len(files_dict),
        "total_chunks": len(all_chunks)
    }


@app.delete("/clear")
async def clear_all():
    """Sab kuch delete karo"""
    global all_chunks, all_sources, faiss_index
    all_chunks = []
    all_sources = []
    faiss_index = None

    # Data folder saaf karo
    for f in os.listdir(DATA_DIR):
        try:
            os.remove(os.path.join(DATA_DIR, f))
        except Exception as e:
            print(f"Could not delete {f}: {e}")

    # FIX 7: FAISS index file bhi delete karo
    # Pehle siraf memory clear hoti thi, disk pe file rehti thi
    if os.path.exists(FAISS_INDEX_PATH):
        os.remove(FAISS_INDEX_PATH)
    if os.path.exists(METADATA_PATH):
        os.remove(METADATA_PATH)

    return {"message": "All data cleared successfully", "total_chunks": 0}


@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "chunks": len(all_chunks),
        "files": len(set([s["file"] for s in all_sources])),
        "index_loaded": faiss_index is not None
    }


if __name__ == "__main__":
    import uvicorn
    print("\n🚀 Starting Document Chatbot Backend...")
    print("📍 URL: http://localhost:8000")
    print("📖 API Docs: http://localhost:8000/docs")
    print("✅ Supported formats: PDF, DOCX, TXT, CSV, Excel, JSON\n")
    uvicorn.run(app, host="0.0.0.0", port=8000)