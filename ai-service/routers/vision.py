from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from services.ocr_service import extract_document_ocr
from services.cache_service import document_cache

router = APIRouter(prefix="/v1/vision", tags=["Vision & Document OCR"])

@router.post("/ocr")
async def process_document_ocr(
    file: UploadFile = File(...),
    tenant_id: str = Form("default")
):
    """
    Extract structured data and text from images (receipts, warranties, error screenshots).
    Utilizes SHA-256 in-memory caching to avoid repeated inference for identical documents.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="Missing image file")

    try:
        # Read content for caching check
        content = await file.read()
        cached = document_cache.get([content], tenant_id=tenant_id)
        if cached:
            return {
                "source": "cache",
                "filename": file.filename,
                "data": cached
            }

        # Reset cursor for OCR service
        await file.seek(0)
        ocr_result = await extract_document_ocr(file)

        # Store in cache
        document_cache.set([content], ocr_result, tenant_id=tenant_id)

        return {
            "source": "inference",
            "filename": file.filename,
            "data": ocr_result
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Vision OCR processing error: {str(exc)}")
