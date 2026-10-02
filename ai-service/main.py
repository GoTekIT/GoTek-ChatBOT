import sys
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv, find_dotenv

if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Load environment variables (.env from current dir or monorepo root)
env_path = find_dotenv()
if env_path:
    load_dotenv(env_path)
else:
    load_dotenv()

from routers import chat, audio, vision, embedding, training
from services.training_manager import training_manager

app = FastAPI(
    title="GoTek AI Microservice",
    description="Enterprise AI Inference, Multimodal Vision OCR, STT and Embeddings for GoTek Customer Support Chatbot",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS middleware for local development & production dashboard
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1):.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register specialized AI feature routers
app.include_router(chat.router)
app.include_router(audio.router)
app.include_router(vision.router)
app.include_router(embedding.router)
app.include_router(training.router)

@app.get("/")
def read_root():
    return {
        "status": "ok",
        "service": "gotek-ai-service",
        "version": "1.0.0",
        "capabilities": [
            "chat-completions (Groq, Gemini, DeepSeek, OpenRouter)",
            "audio-transcriptions (Groq Whisper Turbo)",
            "vision-ocr (Receipt, Warranty, Screenshot OCR)",
            "embeddings (Gemini & Cohere vectors)",
            "training-monitor (/v1/training/status, /v1/training/start)"
        ]
    }

@app.get("/health")
def health_check():
    hardware = training_manager.get_hardware_info()
    return {
        "status": "healthy",
        "service": "gotek-ai-service",
        "environment": os.getenv("NODE_ENV", "development"),
        "training_job": {
            "status": training_manager.status,
            "job_id": training_manager.job_id,
            "progress_percentage": training_manager.progress_pct,
            "current_loss": training_manager.current_loss,
            "monitor_endpoint": "/v1/training/status"
        },
        "hardware": hardware
    }

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
