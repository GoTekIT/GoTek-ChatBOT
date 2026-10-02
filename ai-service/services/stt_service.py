import os
import httpx
from fastapi import UploadFile

async def transcribe_audio(audio_file: UploadFile) -> str:
    """
    GoTek Chatbot Audio Transcription using Groq Whisper (whisper-large-v3-turbo).
    Transcribes Vietnamese customer voice messages in < 400ms.
    """
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise RuntimeError("GROQ_API_KEY is not configured for Audio Transcription")

    content = await audio_file.read()
    filename = audio_file.filename or "voice_message.wav"
    content_type = audio_file.content_type or "audio/wav"

    async with httpx.AsyncClient(timeout=45.0) as client:
        response = await client.post(
            "https://api.groq.com/openai/v1/audio/transcriptions",
            headers={"Authorization": f"Bearer {api_key}"},
            files={"file": (filename, content, content_type)},
            data={
                "model": "whisper-large-v3-turbo",
                "language": "vi",
                "temperature": "0",
                "prompt": (
                    "Ngữ cảnh tư vấn khách hàng doanh nghiệp tại Việt Nam: "
                    "hỏi giá, đơn hàng, bảo hành, thanh toán, đổi trả, số điện thoại, địa chỉ."
                ),
            },
        )

        if response.status_code != 200:
            raise RuntimeError(f"Groq Whisper error ({response.status_code}): {response.text}")

        res_json = response.json()
        return res_json.get("text", "").strip()
