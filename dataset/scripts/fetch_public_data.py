"""
Fetch public product data & generate standardized Vietnamese E-commerce policy documents.
Part of GoTek Chatbot Training Pipeline.
"""
import os
import sys
import json
import httpx

if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

DATASET_RAW_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "raw"))
POLICIES_DIR = os.path.join(DATASET_RAW_DIR, "policies")
PRODUCTS_DIR = os.path.join(DATASET_RAW_DIR, "products")

os.makedirs(POLICIES_DIR, exist_ok=True)
os.makedirs(PRODUCTS_DIR, exist_ok=True)

# ------------------------------------------------------------------------------
# 1. FETCH PUBLIC PRODUCTS (DummyJSON API)
# ------------------------------------------------------------------------------
def fetch_and_save_public_products():
    print("[1/2] Đang tải danh mục sản phẩm công khai từ DummyJSON API...", flush=True)
    url = "https://dummyjson.com/products?limit=100"
    try:
        with httpx.Client(timeout=30.0) as client:
            response = client.get(url)
            response.raise_for_status()
            data = response.json()
            products = data.get("products", [])

        processed_products = []
        for p in products:
            # Quy đổi giá USD sang VND tương đối (x 25.000)
            vnd_price = int(p.get("price", 10) * 25000)
            processed_products.append({
                "product_id": f"PRD-{p['id']:04d}",
                "name": p.get("title"),
                "category": p.get("category"),
                "brand": p.get("brand", "GoTek Partner"),
                "price": vnd_price,
                "price_formatted": f"{vnd_price:,} đ",
                "discount_percentage": p.get("discountPercentage", 0),
                "stock": p.get("stock", 50),
                "rating": p.get("rating", 4.5),
                "description": p.get("description"),
                "warranty_period": "12 tháng chính hãng",
                "return_policy": "Đổi mới trong 7 ngày nếu lỗi nhà sản xuất"
            })

        output_file = os.path.join(PRODUCTS_DIR, "sample_products.json")
        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(processed_products, f, ensure_ascii=False, indent=2)

        print(f"✅ Đã tải và chuẩn hóa {len(processed_products)} sản phẩm tại: {output_file}", flush=True)
        return processed_products
    except Exception as exc:
        print(f"⚠️ Lỗi tải sản phẩm từ API: {exc}", flush=True)
        return []

# ------------------------------------------------------------------------------
# 2. GENERATE STANDARDIZED VIETNAMESE POLICIES
# ------------------------------------------------------------------------------
POLICIES = {
    "chinh_sach_doi_tra.md": """# CHÍNH SÁCH ĐỔI TRẢ VÀ HOÀN TIỀN GOTEK

## 1. Thời hạn áp dụng
- Khách hàng được quyền yêu cầu đổi hàng hoặc hoàn tiền trong vòng **07 ngày** kể từ ngày nhận hàng thành công theo ghi nhận của đơn vị vận chuyển.
- Đối với trường hợp đổi size áo quần hoặc màu sắc sản phẩm: Hỗ trợ đổi 01 lần duy nhất trong vòng 05 ngày.

## 2. Điều kiện chấp nhận đổi trả
- Sản phẩm còn nguyên tem mác niêm phong, bao bì gốc và quà tặng kèm theo (nếu có).
- Sản phẩm chưa qua giặt ủi, sử dụng, không bị dơ bẩn, trầy xước hoặc có mùi lạ.
- Có video quay lại quá trình mở hộp kiện hàng (unboxing) rõ nét 6 mặt hộp và mã vận đơn.

## 3. Các trường hợp từ chối đổi trả
- Quá thời hạn 07 ngày kể từ khi nhận hàng.
- Sản phẩm thuộc danh mục hàng thanh lý xả kho (Final Sale) hoặc đồ lót, đồ cá nhân vệ sinh.
- Hư hỏng do sử dụng sai hướng dẫn, va đập, rơi vỡ hoặc tự ý tháo dỡ sửa chữa.

## 4. Chi phí vận chuyển đổi trả
- Lỗi phát sinh từ phía shop (giao sai hàng, hàng lỗi kỹ thuật, thiếu phụ kiện): **Shop chịu 100% phí ship 2 chiều**.
- Đổi theo nhu cầu cá nhân của khách (đổi size, đổi màu, không thích nữa): **Khách hàng chịu phí vận chuyển 2 chiều (đồng giá 30.000đ/lượt)**.

## 5. Thời gian hoàn tiền
- Sau khi nhận lại hàng và kiểm tra hợp lệ, tiền sẽ được hoàn về tài khoản ngân hàng của khách trong vòng **24h đến 48h làm việc**.""",

    "chinh_sach_bao_hanh.md": """# CHÍNH SÁCH BẢO HÀNH VÀ SỬA CHỮA GOTEK

## 1. Thời gian bảo hành
- Thiết bị điện tử, phần cứng: Bảo hành **12 đến 24 tháng** tùy danh mục sản phẩm niêm yết.
- Phụ kiện đi kèm (cáp sạc, củ sạc, tai nghe kèm hộp): Bảo hành **06 tháng**.
- Màn hình hiển thị: Bảo hành **12 tháng** (áp dụng khi có từ 03 điểm chết trở lên).

## 2. Quy trình tiếp nhận bảo hành
- Bước 1: Khách hàng gửi hình ảnh / video mô tả lỗi và số Serial/IMEI máy qua khung chat CSKH.
- Bước 2: Nhân viên kỹ thuật xác nhận sơ bộ lỗi phần mềm hay phần cứng.
- Bước 3: Khách gửi máy về Trung tâm Bảo hành GoTek tại Hà Nội hoặc TP.HCM.
- Bước 4: Thời gian xử lý kiểm tra và sửa chữa: Từ **03 đến 07 ngày làm việc**.

## 3. Điều kiện từ chối bảo hành
- Sản phẩm bị rơi vỡ, nứt mẻ, biến dạng khung vỏ, có dấu hiệu ngấm nước hoặc hóa chất.
- Tem bảo hành hoặc mã vạch Serial/IMEI bị rách, mờ, tẩy xóa hoặc chắp vá.
- Thiết bị đã bị can thiệp phần cứng, tháo ốc bởi thợ bên ngoài không thuộc ủy quyền.""",

    "chinh_sach_giao_hang_kiem_hang.md": """# CHÍNH SÁCH VẬN CHUYỂN VÀ ĐỒNG KIỂM HÀNG

## 1. Biểu phí và thời gian giao hàng
- **Giao hỏa tốc 2H (Nội thành Hà Nội & TP.HCM)**: Phí 35.000đ - 50.000đ tùy khoảng cách. Áp dụng cho đơn đặt trước 17h00 hàng ngày.
- **Giao tiêu chuẩn toàn quốc**:
  - Đơn hàng dưới 300.000đ: Phí vận chuyển đồng giá **25.000đ**.
  - Đơn hàng từ 300.000đ trở lên: **MIỄN PHÍ VẬN CHUYỂN TOÀN QUỐC (Freeship)**.
  - Thời gian nhận hàng: Miền Bắc & Miền Nam 1-2 ngày; Miền Trung và tuyến huyện/xã 3-4 ngày.

## 2. Quy định Đồng kiểm hàng (Được xem hàng trước khi nhận)
- GoTek áp dụng chính sách **CHO PHÉP ĐỒNG KIỂM** trước mặt nhân viên giao hàng (Shipper).
- Khách hàng được quyền mở hộp kiểm tra đúng mẫu mã, màu sắc, số lượng và ngoại quan không bể vỡ.
- Lưu ý: Không được bóc seal nilon của sản phẩm hoặc cắm điện dùng thử tại chỗ.
- Nếu hàng bị móp méo hoặc sai mẫu, khách hàng có quyền từ chối nhận hàng mà không mất bất kỳ chi phí nào.""",

    "chinh_sach_bao_mat_va_khieu_nai.md": """# CHÍNH SÁCH BẢO MẬT VÀ QUY TRÌNH KHIẾU NẠI

## 1. Cam kết bảo mật thông tin khách hàng
- GoTek cam kết tuyệt đối không chia sẻ, bán hoặc để lộ số điện thoại, địa chỉ, lịch sử đơn hàng của khách cho bên thứ ba vì mục đích thương mại.
- Mọi dữ liệu giao dịch thẻ tín dụng và tài khoản ngân hàng đều được mã hóa theo chuẩn PCI-DSS.

## 2. Quy trình tiếp nhận và giải quyết khiếu nại
- Mọi khiếu nại về thái độ nhân viên, giao hàng chậm, hàng lỗi đều được tiếp nhận 24/7 qua khung chat hoặc Hotline: `1900-6868`.
- Thời hạn phản hồi ban đầu: Trong vòng **02 giờ** làm việc.
- Thời hạn giải quyết dứt điểm: Tối đa **24 giờ** kể từ khi tiếp nhận đầy đủ bằng chứng.
- Nếu lỗi thuộc về hệ thống gây thiệt hại cho khách hàng, GoTek cam kết hoàn tiền 100% kèm voucher đền bù 50.000đ - 100.000đ cho đơn hàng kế tiếp."""
}

def generate_policy_files():
    print("[2/2] Đang khởi tạo các văn bản chính sách TMĐT chuẩn Việt Nam...", flush=True)
    for filename, content in POLICIES.items():
        filepath = os.path.join(POLICIES_DIR, filename)
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content.strip())
        print(f"✅ Đã tạo tài liệu chính sách: {filename}", flush=True)

if __name__ == "__main__":
    print("=" * 60)
    print("BẮT ĐẦU THU THẬP VÀ CHUẨN HÓA DỮ LIỆU SEED (PRODUCTS & POLICIES)")
    print("=" * 60)
    fetch_and_save_public_products()
    generate_policy_files()
    print("=" * 60)
    print("HOÀN TẤT THU THẬP DỮ LIỆU! SẴN SÀNG CHO BƯỚC SINH SYNTHETIC DATASET.")
    print("=" * 60)
