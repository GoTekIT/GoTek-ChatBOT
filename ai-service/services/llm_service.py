import os
import json
import httpx
from groq import AsyncGroq

def get_groq_client() -> AsyncGroq | None:
    key = os.getenv("GROQ_API_KEY")
    if not key:
        return None
    return AsyncGroq(api_key=key)

def get_deepseek_api_key() -> str | None:
    return os.getenv("DEEPSEEK_API_KEY")

def get_openrouter_api_key() -> str | None:
    return os.getenv("OPEN_ROUTER_API") or os.getenv("OPENROUTER_API_KEY")

def get_gemini_api_key() -> str | None:
    return os.getenv("GEMINI_API_KEY")

async def call_llm(
    messages: list[dict],
    temperature: float = 0.3,
    preferred_model: str | None = None
) -> str:
    """
    GoTek Chatbot Multi-Tier Fallback LLM Engine:
    1. Tier 1: Groq (Ultra-fast LLaMA-3.3-70B / Qwen-2.5-32B)
    2. Tier 2: Google Gemini (Gemini 1.5 Flash / Pro)
    3. Tier 3: DeepSeek (deepseek-chat)
    4. Tier 4: OpenRouter (Universal Multi-Model Gateway)
    """
    errors = []

    # 1. Tier 1: Groq
    groq_client = get_groq_client()
    if groq_client:
        models_to_try = [preferred_model] if preferred_model and "llama" in preferred_model.lower() else ["llama-3.3-70b-versatile", "qwen-2.5-32b"]
        for model in models_to_try:
            try:
                response = await groq_client.chat.completions.create(
                    model=model,
                    messages=messages,
                    temperature=temperature,
                )
                content = response.choices[0].message.content
                if content and content.strip():
                    return content
            except Exception as exc:
                errors.append(f"Groq ({model}): {exc}")

    # 2. Tier 2: Google Gemini
    gemini_key = get_gemini_api_key()
    if gemini_key:
        try:
            # Map chat history format to Gemini format
            gemini_model = os.getenv("GEMINI_MODEL_NAME", "gemini-1.5-flash")
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{gemini_model}:generateContent?key={gemini_key}"
            contents = []
            for m in messages:
                role = "model" if m.get("role") in ["assistant", "ai", "model"] else "user"
                contents.append({"role": role, "parts": [{"text": m.get("content", "")}]})

            async with httpx.AsyncClient(timeout=30.0) as client:
                res = await client.post(url, json={"contents": contents})
                if res.status_code == 200:
                    data = res.json()
                    text = data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
                    if text.strip():
                        return text
                else:
                    errors.append(f"Gemini HTTP {res.status_code}: {res.text}")
        except Exception as exc:
            errors.append(f"Gemini: {exc}")

    # 3. Tier 3: DeepSeek
    deepseek_key = get_deepseek_api_key()
    if deepseek_key:
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                res = await client.post(
                    "https://api.deepseek.com/chat/completions",
                    headers={"Authorization": f"Bearer {deepseek_key}", "Content-Type": "application/json"},
                    json={"model": "deepseek-chat", "messages": messages, "temperature": temperature}
                )
                if res.status_code == 200:
                    data = res.json()
                    content = data["choices"][0]["message"]["content"]
                    if content and content.strip():
                        return content
                else:
                    errors.append(f"DeepSeek HTTP {res.status_code}: {res.text}")
        except Exception as exc:
            errors.append(f"DeepSeek: {exc}")

    # 4. Tier 4: OpenRouter
    openrouter_key = get_openrouter_api_key()
    if openrouter_key:
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                res = await client.post(
                    "https://openrouter.ai/api/v1/chat/completions",
                    headers={"Authorization": f"Bearer {openrouter_key}", "Content-Type": "application/json"},
                    json={"model": "deepseek/deepseek-chat", "messages": messages, "temperature": temperature}
                )
                if res.status_code == 200:
                    data = res.json()
                    content = data["choices"][0]["message"]["content"]
                    if content and content.strip():
                        return content
                else:
                    errors.append(f"OpenRouter HTTP {res.status_code}: {res.text}")
        except Exception as exc:
            errors.append(f"OpenRouter: {exc}")

    raise RuntimeError(f"All LLM tiers failed. Errors: {'; '.join(errors)}")

async def call_llm_json(messages: list[dict], temperature: float = 0.1) -> dict:
    """Call LLM and parse response as structured JSON."""
    raw = await call_llm(messages, temperature=temperature)
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        start = raw.find("{")
        end = raw.rfind("}") + 1
        if start >= 0 and end > start:
            return json.loads(raw[start:end])
        raise ValueError(f"LLM did not return valid JSON: {raw[:300]}")
