import os
import base64
import json
import httpx
from fastapi import UploadFile

DOCUMENT_OCR_PROMPT = """Bạn là trợ lý AI chuyên phân tích tài liệu và hình ảnh khách hàng gửi đến bộ phận CSKH.
Nhiệm vụ của bạn:
1. Xác định loại tài liệu:
   - "INVOICE_RECEIPT": Hóa đơn, biên lai chuyển tiền, hóa đơn đỏ, bill giao hàng.
   - "WARRANTY_CARD": Phiếu bảo hành, tem bảo hành, mã bảo hành.
   - "ERROR_SCREENSHOT": Ảnh chụp màn hình lỗi ứng dụng, website, thanh toán.
   - "PRODUCT_ISSUE": Ảnh chụp sản phẩm bị hỏng hóc, trầy xước, nứt vỡ.
   - "GENERAL_DOCUMENT": Các tài liệu văn bản khác.
2. Trích xuất toàn bộ văn bản có trong ảnh (raw_text).
3. Trích xuất các thực thể quan trọng (entities):
   - order_id: Mã đơn hàng (nếu có)
   - total_amount: Số tiền thanh toán (nếu có)
   - customer_name: Tên khách hàng (nếu có)
   - phone: Số điện thoại (nếu có)
   - transaction_id: Mã giao dịch ngân hàng / ví điện tử (nếu có)
   - date: Ngày giao dịch / ngày mua hàng (nếu có)

BẮT BUỘC TRẢ VỀ JSON HỢP LỆ THEO SCHEMA DƯỚI ĐÂY (KHÔNG KÈM GIẢI THÍCH):
{
  "document_type": "INVOICE_RECEIPT",
  "summary": "Tóm tắt ngắn gọn nội dung ảnh trong 1 câu",
  "raw_text": "Văn bản trích xuất...",
  "entities": {
    "order_id": null,
    "total_amount": null,
    "customer_name": null,
    "phone": null,
    "transaction_id": null,
    "date": null
  },
  "confidence": 0.95
}
"""

async def extract_document_ocr(image_file: UploadFile) -> dict:
    """
    Extract text and structured metadata from customer images using Gemini Vision or OpenRouter Vision.
    """
    content = await image_file.read()
    b64_image = base64.b64encode(content).decode("utf-8")
    mime_type = image_file.content_type or "image/jpeg"

    gemini_key = os.getenv("GEMINI_API_KEY")
    if gemini_key:
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={gemini_key}"
            payload = {
                "contents": [
                    {
                        "parts": [
                            {"text": DOCUMENT_OCR_PROMPT},
                            {
                                "inline_data": {
                                    "mime_type": mime_type,
                                    "data": b64_image
                                }
                            }
                        ]
                    }
                ],
                "generationConfig": {
                    "response_mime_type": "application/json"
                }
            }
            async with httpx.AsyncClient(timeout=45.0) as client:
                res = await client.post(url, json=payload)
                if res.status_code == 200:
                    data = res.json()
                    raw_json = data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "{}")
                    return json.loads(raw_json)
        except Exception as exc:
            print(f"[OCR] Gemini Vision failed: {exc}")

    return {
        "document_type": "GENERAL_DOCUMENT",
        "summary": "Không thể xử lý OCR tự động",
        "raw_text": "",
        "entities": {},
        "confidence": 0.0
    }
