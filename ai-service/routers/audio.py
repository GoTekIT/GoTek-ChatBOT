from fastapi import APIRouter, UploadFile, File, HTTPException
from services.stt_service import transcribe_audio

router = APIRouter(prefix="/v1/audio", tags=["Audio & Speech-To-Text"])

@router.post("/transcriptions")
async def create_transcription(file: UploadFile = File(...)):
    """
    Transcribe customer voice messages into Vietnamese text in < 400ms using Groq Whisper Turbo.
    Supports formats: mp3, mp4, mpeg, mpga, m4a, wav, webm, ogg.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="Missing audio file")

    try:
        text = await transcribe_audio(file)
        return {
            "text": text,
            "filename": file.filename,
            "language": "vi"
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Audio transcription error: {str(exc)}")
