@echo off
title Building EXE
color 0A

echo ========================================
echo   Building RAG Chatbot EXE
echo ========================================
echo.

echo Installing PyInstaller...
pip install pyinstaller

echo.
echo Building EXE (this may take 5-10 minutes)...
cd backend

pyinstaller --onefile --name "RAG_Chatbot" ^
            --add-data "app.py;." ^
            --hidden-import="sentence_transformers" ^
            --hidden-import="faiss" ^
            --hidden-import="pypdf" ^
            --hidden-import="ollama" ^
            --collect-all=sentence_transformers ^
            app.py

cd ..

echo.
echo Moving EXE to dist folder...
if not exist dist mkdir dist
move backend\dist\RAG_Chatbot.exe dist\

echo.
echo ========================================
echo   EXE Build Complete! 🎉
echo ========================================
echo.
echo EXE location: dist\RAG_Chatbot.exe
echo.
echo To run on client machine:
echo 1. Copy dist\RAG_Chatbot.exe
echo 2. Client must have Ollama installed
echo 3. Client must run: ollama pull mistral
echo.
pause