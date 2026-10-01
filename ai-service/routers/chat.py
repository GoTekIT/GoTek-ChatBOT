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

    # Format messages into conversation string for llm_service
    formatted_convo = []
    system_instruction = ""
    for msg in request.messages:
        if msg.role.lower() == "system":
            system_instruction += f"{msg.content}\n"
        else:
            role_label = "Khách hàng" if msg.role.lower() == "user" else "Trợ lý CSKH"
            formatted_convo.append(f"{role_label}: {msg.content}")

    prompt = ""
    if system_instruction:
        prompt += f"[Chỉ dẫn hệ thống]:\n{system_instruction.strip()}\n\n"
    prompt += "\n".join(formatted_convo)

    try:
        reply_text = await call_llm(
            prompt=prompt,
            temperature=request.temperature or 0.2,
            max_tokens=request.max_tokens or 1024
        )

        approx_prompt_tokens = max(1, len(prompt) // 4)
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
