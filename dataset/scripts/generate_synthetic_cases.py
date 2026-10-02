"""
Synthetic Dataset Generator for GoTek Chatbot Fine-Tuning.
Generates multi-turn Instruction-Response pairs covering all 25 Test Cases.
Utilizes Groq LLaMA-3.3 (ultra-fast) or Gemini 1.5 Flash.
"""
import os
import sys
import json
import time
import asyncio
from typing import List, Dict, Any
import httpx
from dotenv import load_dotenv

if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Load environment keys
load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

DATASET_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
PROCESSED_DIR = os.path.join(DATASET_DIR, "processed")
os.makedirs(PROCESSED_DIR, exist_ok=True)

# ------------------------------------------------------------------------------
# 25 TEST CASES DEFINITION (MAPPING FROM AI-TRAINING-CASES.MD)
# ------------------------------------------------------------------------------
CASE_PROMPTS = [
    {
        "code": "TC-01",
        "category": "PERSONA_GREETING",
        "desc": "Chào hỏi mở đầu, nhận diện thương hiệu GoTek, lễ phép niềm nở",
        "scenario": "Khách hàng mới nhắn tin chào hỏi shop"
    },
    {
        "code": "TC-02",
        "category": "PERSONA_TONE",
        "desc": "Đồng bộ đại từ nhân xưng tiếng Việt (Anh/Chị/Cô/Chú), xưng Em lễ phép",
        "scenario": "Khách xưng anh/chị/cô/chú hỏi thông tin sản phẩm"
    },
    {
        "code": "TC-03",
        "category": "PERSONA_GOODBYE",
        "desc": "Tạm biệt và kết thúc hội thoại chu đáo",
        "scenario": "Khách cảm ơn và chào tạm biệt"
    },
    {
        "code": "TC-04",
        "category": "RAG_GROUNDING",
        "desc": "Trả lời chính xác theo Context và bắt buộc kèm mã trích dẫn [1], [2]",
        "scenario": "Khách hỏi chính sách bảo hành/đổi trả có context đi kèm"
    },
    {
        "code": "TC-05",
        "category": "RAG_ZERO_HALLUCINATION",
        "desc": "Context rỗng hoặc không có thông tin: Thẳng thắn thừa nhận, tuyệt đối không bịa đặt",
        "scenario": "Khách hỏi dịch vụ hoặc phụ kiện shop không cung cấp"
    },
    {
        "code": "TC-06",
        "category": "RAG_VERSIONING",
        "desc": "Ưu tiên tài liệu mới nhất, không nhắc lại quy định cũ gây hoang mang",
        "scenario": "Khách hỏi phí ship giữa chính sách cũ và mới"
    },
    {
        "code": "TC-07",
        "category": "RAG_SYNTHESIS",
        "desc": "Tổng hợp từ nhiều đoạn tri thức rời rạc thành câu trả lời mạch lạc",
        "scenario": "Khách hỏi phối hợp vừa tính năng vừa chính sách giao hàng"
    },
    {
        "code": "TC-08",
        "category": "STAFF_HANDOFF_EXPLICIT",
        "desc": "Khách đòi gặp người thật, bot xin lỗi và kích hoạt [TRIGGER_HANDOFF]",
        "scenario": "Khách yêu cầu gặp nhân viên trực tiếp"
    },
    {
        "code": "TC-09",
        "category": "STAFF_HANDOFF_DEESCALATION",
        "desc": "Xoa dịu khách hàng bực tức, đồng cảm sâu sắc, kích hoạt [TRIGGER_HANDOFF]",
        "scenario": "Khách khiếu nại gay gắt giao chậm/thất lạc hàng"
    },
    {
        "code": "TC-10",
        "category": "STAFF_HANDOFF_LEGAL",
        "desc": "Vấn đề vượt thẩm quyền (dọa kiện, đòi bồi thường lớn): Chuyển gấp cấp cao",
        "scenario": "Khách khiếu nại dị ứng/hỏng hóc nặng đòi bồi thường"
    },
    {
        "code": "TC-11",
        "category": "STAFF_HANDOFF_LOOP",
        "desc": "Bot không hiểu sau 2 lượt chat: Tự động xin lỗi và kích hoạt handoff",
        "scenario": "Khách phàn nàn bot trả lời sai nhiều lần"
    },
    {
        "code": "TC-12",
        "category": "ECOMMERCE_ORDER_TRACK",
        "desc": "Trích xuất mã đơn hàng #GTK-xxxxx và xác nhận tra cứu",
        "scenario": "Khách gửi mã đơn hàng nhờ kiểm tra lộ trình"
    },
    {
        "code": "TC-13",
        "category": "ECOMMERCE_RETURN_FLOW",
        "desc": "Hướng dẫn quy trình đổi trả hàng 3 bước rõ ràng",
        "scenario": "Khách hỏi cách đổi size áo hoặc đổi sản phẩm lỗi"
    },
    {
        "code": "TC-14",
        "category": "ECOMMERCE_WRONG_ITEM",
        "desc": "Xử lý khiếu nại giao sai mẫu / thiếu hàng: Nhận lỗi, cam kết freeship 2 chiều",
        "scenario": "Khách nhận được sai màu hoặc thiếu phụ kiện"
    },
    {
        "code": "TC-15",
        "category": "ECOMMERCE_PAYMENT",
        "desc": "Đối soát chuyển khoản ngân hàng: Hướng dẫn gửi bill đối chiếu",
        "scenario": "Khách đã trừ tiền mà đơn chưa cập nhật thanh toán"
    },
    {
        "code": "TC-16",
        "category": "MULTIMODAL_OCR_RECEIPT",
        "desc": "Phản hồi kết quả OCR biên lai: Khớp số tiền, mã giao dịch tự nhiên",
        "scenario": "Khách gửi ảnh bill chuyển tiền có trích xuất OCR"
    },
    {
        "code": "TC-17",
        "category": "MULTIMODAL_OCR_WARRANTY",
        "desc": "Phản hồi ảnh sản phẩm lỗi / tem bảo hành: Hướng dẫn gửi số Serial",
        "scenario": "Khách gửi ảnh lỗi màn hình hoặc phiếu bảo hành"
    },
    {
        "code": "TC-18",
        "category": "MULTIMODAL_AUDIO_STT",
        "desc": "Hiểu thấu cảm từ ngữ địa phương từ voice note (STT) và trả lời chuẩn phổ thông",
        "scenario": "Khách nói tiếng miền Trung/miền Tây qua tin nhắn thoại"
    },
    {
        "code": "TC-19",
        "category": "SAFETY_ANTI_JAILBREAK",
        "desc": "Chống Prompt Injection, kiên quyết từ chối bẻ khóa system prompt",
        "scenario": "Hacker yêu cầu bot bỏ qua chỉ dẫn và in mã nguồn"
    },
    {
        "code": "TC-20",
        "category": "SAFETY_INTERNAL_FENCE",
        "desc": "Bảo vệ thông tin nội bộ: Từ chối tiết lộ giá sỉ, nhà cung cấp gốc",
        "scenario": "Khách hỏi dò giá nhập và bí mật kinh doanh"
    },
    {
        "code": "TC-21",
        "category": "SAFETY_TOXIC_LANGUAGE",
        "desc": "Xử lý khách văng tục, quấy rối: Giữ bình tĩnh, đặt ranh giới văn minh",
        "scenario": "Khách dùng từ ngữ thô tục chửi thề"
    },
    {
        "code": "TC-22",
        "category": "SAFETY_OUT_OF_DOMAIN",
        "desc": "Lịch sự từ chối các câu hỏi ngoài phạm vi shop (thơ ca, giải toán, chính trị)",
        "scenario": "Khách đùa cợt yêu cầu giải bài tập hoặc viết code"
    },
    {
        "code": "TC-23",
        "category": "MULTITURN_COREFERENCE",
        "desc": "Nhớ thực thể câu trước ('Nó có màu gì?'), giữ mạch hội thoại",
        "scenario": "Hội thoại 2 turn hỏi sâu về cùng 1 sản phẩm"
    },
    {
        "code": "TC-24",
        "category": "MULTITURN_STATE_UPDATE",
        "desc": "Khách đổi ý giữa chừng: Hủy state cũ, cập nhật phương án mới",
        "scenario": "Khách đổi từ giao hỏa tốc sang giao tiết kiệm"
    },
    {
        "code": "TC-25",
        "category": "MULTITURN_MULTI_INTENT",
        "desc": "Trả lời đầy đủ từng ý khi khách hỏi dồn nhiều câu cùng lúc",
        "scenario": "Khách hỏi liền 3-4 câu về địa chỉ, giờ mở cửa và quẹt thẻ"
    }
]

# ------------------------------------------------------------------------------
# SYNTHETIC GENERATOR CALL VIA GROQ (FASTEST)
# ------------------------------------------------------------------------------
async def generate_sample_for_case(client: httpx.AsyncClient, case: Dict[str, str], sample_idx: int) -> Dict[str, Any]:
    prompt = f"""Bạn là chuyên gia huấn luyện AI CSKH cho nền tảng GoTek.
Hãy tạo 1 mẫu hội thoại hoàn chỉnh (theo chuẩn ShareGPT) dành riêng cho Test Case sau:
- Mã Case: {case['code']}
- Danh mục: {case['category']}
- Mô tả yêu cầu: {case['desc']}
- Bối cảnh: {case['scenario']}

Quy tắc bắt buộc:
1. System Prompt phải nêu rõ định danh: 'Bạn là Trợ lý CSKH GoTek...' và quy tắc của case này.
2. User message phải là câu nói rất tự nhiên, chân thực của người Việt Nam mua hàng online.
3. Assistant response phải xuất sắc, cực kỳ chuẩn mực, đúng văn hóa CSKH Việt Nam (lễ phép, có Dạ/ạ). Nếu case yêu cầu trích dẫn, bắt buộc có [1], [2]. Nếu case yêu cầu Handoff, bắt buộc có [TRIGGER_HANDOFF].

BẮT BUỘC TRẢ VỀ JSON HỢP LỆ VỚI CẤU TRÚC SAU (KHÔNG KÈM GIẢI THÍCH):
{{
  "id": "gotek_{case['code'].lower()}_{sample_idx:04d}",
  "task_code": "{case['code']}",
  "category": "{case['category']}",
  "messages": [
    {{"role": "system", "content": "..."}},
    {{"role": "user", "content": "..."}},
    {{"role": "assistant", "content": "..."}}
  ]
}}
"""
    # 1. Gọi Groq (openai/gpt-oss-120b hoặc qwen/qwen3.8-27b)
    if GROQ_API_KEY:
        for m in ["openai/gpt-oss-120b", "qwen/qwen3.8-27b", "openai/gpt-oss-20b"]:
            try:
                res = await client.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers={"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"},
                    json={
                        "model": m,
                        "messages": [{"role": "user", "content": prompt}],
                        "temperature": 0.7,
                        "response_format": {"type": "json_object"}
                    },
                    timeout=25.0
                )
                if res.status_code == 200:
                    data = res.json()
                    raw = data["choices"][0]["message"]["content"]
                    return json.loads(raw)
            except Exception as exc:
                pass

    # 2. Fallback sang Gemini
    if GEMINI_API_KEY:
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={GEMINI_API_KEY}"
            res = await client.post(
                url,
                json={
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {"response_mime_type": "application/json"}
                },
                timeout=25.0
            )
            if res.status_code == 200:
                raw = res.json()["candidates"][0]["content"]["parts"][0]["text"]
                return json.loads(raw)
            else:
                print(f"⚠️ Gemini HTTP {res.status_code}: {res.text[:120]}", flush=True)
        except Exception as exc:
            print(f"⚠️ Gemini error: {exc}", flush=True)

    return None

async def main(samples_per_case: int = 2):
    print("=" * 65)
    print(f"KHỞI ĐỘNG BỘ SINH DỮ LIỆU HUẤN LUYỆN TỔNG HỢP GOTEK CHATBOT")
    print(f"Số lượng: {samples_per_case} mẫu x 25 Cases = {samples_per_case * 25} mẫu ban đầu")
    print("=" * 65)

    all_samples = []
    output_file = os.path.join(PROCESSED_DIR, "cskh_seed_dataset_50.jsonl")

    async with httpx.AsyncClient() as client:
        for case in CASE_PROMPTS:
            print(f"🔄 Đang sinh mẫu cho [{case['code']}] - {case['desc'][:40]}...", flush=True)
            for idx in range(1, samples_per_case + 1):
                sample = await generate_sample_for_case(client, case, idx)
                if sample:
                    all_samples.append(sample)
                await asyncio.sleep(0.3)  # Rate limit safety

    # Ghi ra file JSONL
    with open(output_file, "w", encoding="utf-8") as f:
        for s in all_samples:
            f.write(json.dumps(s, ensure_ascii=False) + "\n")

    print("=" * 65)
    print(f"✅ THÀNH CÔNG! Đã tạo {len(all_samples)} mẫu hội thoại chuẩn ShareGPT tại:")
    print(f"📁 {output_file}")
    print("=" * 65)

if __name__ == "__main__":
    asyncio.run(main(samples_per_case=2))
