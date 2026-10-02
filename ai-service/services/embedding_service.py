import os
from typing import List, Optional
import httpx

COHERE_API_KEY = os.getenv("COHERE_API_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

class EmbeddingServiceError(RuntimeError):
    """Raised when embedding generation fails across providers."""

async def get_embedding(text: str, model: str = "text-embedding-004") -> List[float]:
    """
    Generate dense embedding vector for GoTek knowledge chunks and queries.
    Fallback chain:
    1. Gemini Embedding API (if GEMINI_API_KEY is available)
    2. Cohere API (if COHERE_API_KEY is available)
    """
    clean_text = text.strip()
    if not clean_text:
        return []

    # 1. Gemini Embedding
    if GEMINI_API_KEY:
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key={GEMINI_API_KEY}"
            payload = {
                "model": "models/text-embedding-004",
                "content": {"parts": [{"text": clean_text[:10000]}]}
            }
            async with httpx.AsyncClient(timeout=15.0) as client:
                res = await client.post(url, json=payload)
                if res.status_code == 200:
                    data = res.json()
                    values = data.get("embedding", {}).get("values", [])
                    if values:
                        return [float(x) for x in values]
        except Exception as exc:
            print(f"[Embedding] Gemini embedding note: {exc}")

    # 2. Cohere Embedding
    if COHERE_API_KEY:
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                res = await client.post(
                    "https://api.cohere.com/v2/embed",
                    headers={
                        "Authorization": f"Bearer {COHERE_API_KEY}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "texts": [clean_text[:5000]],
                        "model": "embed-multilingual-light-v3.0",
                        "input_type": "search_query",
                        "embedding_types": ["float"],
                        "truncate": "END",
                    },
                )
                if res.status_code == 200:
                    data = res.json()
                    vector = data.get("embeddings", {}).get("float", [[]])[0]
                    if vector:
                        return [float(x) for x in vector]
        except Exception as exc:
            print(f"[Embedding] Cohere embedding note: {exc}")

    raise EmbeddingServiceError("No active embedding provider configured (requires GEMINI_API_KEY or COHERE_API_KEY).")
