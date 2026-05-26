@echo off
title RAG Chatbot - Installation
color 0A

echo ========================================
echo   RAG Chatbot - Installation
echo ========================================
echo.

echo [1/3] Installing Backend Packages...
cd backend
pip install -r requirements.txt
if errorlevel 1 (
    echo ❌ Backend installation failed!
    pause
    exit
)
echo ✅ Backend packages installed
cd ..

echo.
echo [2/3] Installing Frontend Packages...
cd frontend
call npm install
if errorlevel 1 (
    echo ❌ Frontend installation failed!
    pause
    exit
)
echo ✅ Frontend packages installed
cd ..

echo.
echo [3/3] Checking Ollama...
ollama --version >nul 2>&1
if errorlevel 1 (
    echo ⚠️ Ollama not found!
    echo Please download and install Ollama from:
    echo https://ollama.com/download/windows
    echo.
    echo After installing, run: ollama pull mistral
) else (
    echo ✅ Ollama found
    echo.
    echo Checking if mistral model exists...
    ollama list | find "mistral" >nul
    if errorlevel 1 (
        echo ⚠️ Mistral model not found!
        echo Running: ollama pull mistral
        ollama pull mistral
    ) else (
        echo ✅ Mistral model found
    )
)

echo.
echo ========================================
echo   Installation Complete! 🎉
echo ========================================
echo.
echo Next steps:
echo 1. Run start_backend.bat
echo 2. Run start_frontend.bat
echo 3. Open http://localhost:3000
echo.
pause