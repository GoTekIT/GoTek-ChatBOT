import time
import uuid
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from services.llm_service import call_llm

router = APIRouter(prefix="/v1/chat", tags=["Chat & Inference"])

class ChatMessage(BaseModel):
    role: str = Field(..., description="Role of the author: system, user, assistant")
    content: str = Field(..., description="Content of the message")

class ChatCompletionRequest(BaseModel):
    model: Optional[str] = Field("llama-3.3-70b-versatile", description="Model name")
    messages: List[ChatMessage] = Field(..., description="List of messages in conversation")
    temperature: Optional[float] = Field(0.2, ge=0.0, le=2.0)
    max_tokens: Optional[int] = Field(1024, ge=1, le=8192)
    stream: Optional[bool] = False

class ChatChoice(BaseModel):
    index: int = 0
    message: ChatMessage
    finish_reason: str = "stop"

class UsageMetadata(BaseModel):
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0

class ChatCompletionResponse(BaseModel):
    id: str
    object: str = "chat.completion"
    created: int
    model: str
    choices: List[ChatChoice]
    usage: UsageMetadata

@router.post("/completions", response_model=ChatCompletionResponse)
async def create_chat_completion(request: ChatCompletionRequest):
    """
    OpenAI-compatible Chat Completion endpoint for GoTek Chatbot.
    Orchestrates Multi-Tier Fallback:
    Tier 1: Groq LLaMA-3.3 / Qwen-2.5 (<400ms ultra-low latency)
    Tier 2: Google Gemini 1.5 Flash (high context quota)
    Tier 3: DeepSeek V3 (deep reasoning)
    Tier 4: OpenRouter Aggregator
    """
    if not request.messages:
        raise HTTPException(status_code=400, detail="Messages array cannot be empty")

    # Prepare messages payload adhering to OpenAI and multi-tier standards
    messages_payload = [{"role": msg.role, "content": msg.content} for msg in request.messages]

    try:
        reply_text = await call_llm(
            messages=messages_payload,
            temperature=request.temperature or 0.2,
            preferred_model=request.model
        )

        total_prompt_chars = sum(len(m.get("content", "")) for m in messages_payload)
        approx_prompt_tokens = max(1, total_prompt_chars // 4)
        approx_completion_tokens = max(1, len(reply_text) // 4)

        return ChatCompletionResponse(
            id=f"chatcmpl-{uuid.uuid4().hex[:12]}",
            created=int(time.time()),
            model=request.model or "gotek-hybrid-cskh",
            choices=[
                ChatChoice(
                    index=0,
                    message=ChatMessage(role="assistant", content=reply_text),
                    finish_reason="stop"
                )
            ],
            usage=UsageMetadata(
                prompt_tokens=approx_prompt_tokens,
                completion_tokens=approx_completion_tokens,
                total_tokens=approx_prompt_tokens + approx_completion_tokens
            )
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"LLM inference error: {str(exc)}")
