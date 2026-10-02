from typing import List, Optional, Union
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from services.embedding_service import get_embedding

router = APIRouter(prefix="/v1", tags=["Embeddings"])

class EmbeddingRequest(BaseModel):
    input: Union[str, List[str]] = Field(..., description="Text or list of texts to embed")
    model: Optional[str] = Field("text-embedding-004", description="Embedding model identifier")

class EmbeddingObject(BaseModel):
    object: str = "embedding"
    index: int
    embedding: List[float]

class EmbeddingUsage(BaseModel):
    prompt_tokens: int
    total_tokens: int

class EmbeddingResponse(BaseModel):
    object: str = "list"
    data: List[EmbeddingObject]
    model: str
    usage: EmbeddingUsage

@router.post("/embeddings", response_model=EmbeddingResponse)
async def create_embeddings(request: EmbeddingRequest):
    """
    OpenAI-compatible Embedding endpoint for GoTek Chatbot knowledge base.
    """
    texts = [request.input] if isinstance(request.input, str) else request.input
    if not texts:
        raise HTTPException(status_code=400, detail="Input text cannot be empty")

    results: List[EmbeddingObject] = []
    total_tokens = 0

    for idx, text in enumerate(texts):
        try:
            vec = await get_embedding(text, model=request.model or "text-embedding-004")
            results.append(EmbeddingObject(index=idx, embedding=vec))
            total_tokens += max(1, len(text) // 4)
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Embedding error on item {idx}: {str(exc)}")

    return EmbeddingResponse(
        object="list",
        data=results,
        model=request.model or "text-embedding-004",
        usage=EmbeddingUsage(
            prompt_tokens=total_tokens,
            total_tokens=total_tokens
        )
    )
