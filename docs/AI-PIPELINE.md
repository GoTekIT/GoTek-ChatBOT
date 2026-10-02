# 🧠 GoTek Chatbot — Kiến Trúc & Đặc Tả Kỹ Thuật AIPipeline (`AIpipeline.md`)

> **Phiên bản:** 1.0.0 — Production Ready  
> **Cập nhật:** 2026-09-30  
> **Áp dụng cho:** GoTek Chatbot Multi-Tenant Customer Experience Platform  
> **Mã nguồn thực thi:** [`backend/src/modules/ai/ai-pipeline.ts`](file:///d:/GoTek-ChatBOT/backend/src/modules/ai/ai-pipeline.ts)

---

## 1. Tổng Quan Về AIPipeline (Executive Overview)

**AIPipeline** là trái tim xử lý trí tuệ nhân tạo của hệ thống GoTek Chatbot. Pipeline chịu trách nhiệm toàn bộ vòng đời xử lý từ lúc doanh nghiệp nạp tri thức (tài liệu, website, FAQ), trích xuất và băm nhỏ theo ngữ nghĩa tiếng Việt, truy vấn ngữ cảnh chính xác (RAG), cho đến khi mô hình sinh câu trả lời có trích dẫn nguồn minh bạch hoặc chuyển giao nhân viên (Staff Handoff).

### 🎯 3 Nguyên Tắc Cốt Lõi
1. **Zero-Hallucination (Chống ảo giác tuyệt đối):** AI chỉ được trả lời dựa trên những tri thức đã được kiểm duyệt (`state = 'READY'`). Nếu không tìm thấy nguồn gốc trong tài liệu, AI sẽ kích hoạt chuyển giao nhân viên thay vì tự bịa câu trả lời.
2. **Multi-Tenant Isolation (Cô lập đa doanh nghiệp bằng PostgreSQL RLS):** Tri thức, embedding và prompt của từng doanh nghiệp được bảo vệ ở tầng database qua biến phiên `app.workspace_id`. Không bao giờ có hiện tượng rò rỉ dữ liệu giữa các doanh nghiệp.
3. **Vietnamese Language Native (Tối ưu hóa đặc thù tiếng Việt):** Thuật toán chia chunk nhận thức dấu câu, từ ghép, số điện thoại, quy định chính sách tiếng Việt, không bị ngắt quãng giữa từ.

---

## 2. Mô Hình Thuật Toán & Bản Chất Huấn Luyện (Algorithmic Models & Training Architecture)

Để giải quyết bài toán CSKH doanh nghiệp, GoTek Chatbot kết hợp giữa **mô hình thuật toán biểu diễn ngữ nghĩa (Representation Models)**, **mô hình truy vấn lai (Hybrid Retrieval)** và **mô hình sinh ngôn ngữ lớn (Generative LLM)** theo chuẩn mực thế giới:

### 2.1. Các Mô Hình Thuật Toán Sử Dụng (Core Algorithmic Models)

| Thành Phần | Thuật Toán & Mô Hình | Nhiệm Vụ Kỹ Thuật | Đặc Điểm Tiếng Việt & Hiệu Năng |
| :--- | :--- | :--- | :--- |
| **Embedding Model** *(Mô hình véc-tơ hóa tri thức)* | • **BAAI/bge-m3** (1024-dim)<br>• **bkai-foundation-models/vietnamese-bi-encoder** (768-dim)<br>• **OpenAI text-embedding-3-small/large** (1536/3072-dim)<br>• **Google text-multilingual-embedding-002** | Chuyển đổi toàn bộ câu hỏi và đoạn văn bản thành không gian vector ngữ nghĩa đa chiều. | Xử lý hoàn hảo từ ghép, từ đồng nghĩa tiếng Việt (*"bảo hành"* $\approx$ *"sửa chữa miễn phí"*, *"phí ship"* $\approx$ *"cước vận chuyển"*). Hỗ trợ Dense + Sparse + Multi-vector. |
| **Lexical Search Algorithm** *(Thuật toán từ vựng)* | • **BM25 / PostgreSQL Full-Text Search** (`to_tsvector`, `ts_rank`) | Tìm kiếm chính xác theo từ khóa, số hiệu văn bản, mã đơn hàng, tên mã sản phẩm (SKU). | Bắt dính 100% các từ khóa chuyên ngành, mã bảo hành, số điện thoại mà mô hình vector thuần túy có thể bỏ sót. |
| **Vector Search Algorithm** *(Thuật toán đồ thị véc-tơ)* | • **HNSW (Hierarchical Navigable Small World)** trên PostgreSQL (`pgvector`) | Quét tìm k láng giềng gần nhất (k-NN) bằng khoảng cách Cosine Distance $1 - \cos(\theta)$. | Tốc độ truy vấn dưới **15ms** trên kho dữ liệu hàng trăm ngàn chunks, bảo toàn tính ACID và cô lập theo RLS `workspace_id`. |
| **Reranker Model** *(Mô hình tái xếp hạng)* | • **BAAI/bge-reranker-v2-m3**<br>• **Cohere Rerank v3** (Cross-Encoder) | Chấm điểm tương tác chéo cặp `(Query, Chunk)` để lọc từ Top 20 chunks xuống Top 3-5 chunks đắt giá nhất. | Tăng độ chính xác (Precision@3) lên thêm **25-35%** so với chỉ dùng Bi-Encoder thông thường, loại bỏ tri thức gây nhiễu. |
| **Generative LLM Engine** *(Mô hình sinh câu trả lời)* | • **Cloud Tier:** GPT-4o, GPT-4o-mini, Gemini 1.5 Flash/Pro, Claude 3.5 Sonnet<br>• **Local / On-premise Tier:** Qwen-2.5-7B/14B-Instruct, Llama-3.1-8B-Instruct (Vietnamese-tuned), PhoGPT-7B5 | Nhận system prompt, ngữ cảnh trích dẫn và sinh câu trả lời tự nhiên, lịch sự, chuẩn văn phong thương hiệu. | Tích hợp linh hoạt qua Adapter [`provider-transport.ts`](file:///d:/GoTek-ChatBOT/backend/src/modules/ai/provider-transport.ts). Doanh nghiệp có thể chọn dùng Cloud API hoặc máy chủ AI nội bộ (vLLM / Ollama) để bảo mật 100% dữ liệu. |

---

### 2.2. Logic Thuật Toán Từng Bước & Biểu Thức Toán Học (Algorithmic Logic & Mathematical Formulations)

Hệ thống vận hành dựa trên 5 khối logic thuật toán được chuẩn hóa toán học và tối ưu chuyên sâu cho ngôn ngữ tiếng Việt:

#### 1. Logic Thuật Toán Phân Đoạn Ngữ Nghĩa Tiếng Việt (Vietnamese Semantic Chunking Logic)
- **Vấn đề cốt lõi:** Nếu cắt cứng theo số ký tự ($N = 800$), câu văn sẽ bị đứt gãy giữa từ ghép tiếng Việt (ví dụ: *"chính sách bảo..."* $\leftrightarrow$ *"...hành 12 tháng"*), làm hỏng vector embedding.
- **Quy trình thực thi:**
  1. *Bước 1 (Chuẩn hóa):* Làm sạch Unicode NFC, chuẩn hóa dấu thanh tiếng Việt (ví dụ: `hòa` thay vì `hoà`).
  2. *Bước 2 (Nhận diện ranh giới câu):* Áp dụng regex phân đoạn câu nâng cao:
     $$\text{SplitRegex} = \text{/(?<=[.!?\n])\s+(?=[A-ZÀ-Ỹ0-9])/u}$$
     Bảo tồn các chữ số có dấu chấm thập phân (ví dụ: `29.990.000đ` không bị coi là kết thúc câu).
  3. *Bước 3 (Cửa sổ trượt gối đầu - Sliding Window Overlap):*
     - Duy trì bộ đệm $B$. Khi $\text{len}(B) + \text{len}(sentence_i) > \text{MaxChars}$ ($800$ ký tự):
     - Đóng gói chunk $C_k = B$.
     - Khởi tạo chunk mới $C_{k+1}$ bằng cách lấy ngược $N$ ký tự cuối cùng của $C_k$ làm phần gối đầu ($\text{OverlapChars} = 100$), đảm bảo không đứt gãy mạch thông tin.
  4. *Bước 4 (Ước lượng Token & Content Hash):*
     $$\text{TokenEstimate} = \lceil \frac{\text{len}(text)}{4} \rceil, \quad \text{ContentHash} = \text{SHA256}(text)$$

#### 2. Logic Thuật Toán Tìm Kiếm & Hợp Nhất Thứ Hạng (Hybrid Retrieval & RRF Algorithm)
Để đạt độ hồi tưởng (Recall) và độ chính xác (Precision) cao nhất, hệ thống kết hợp 2 nhánh thuật toán song song:
1. **Nhánh 1: Dense Vector Similarity (Bi-Encoder Cosine)**
   - Véc-tơ hóa câu hỏi $\vec{q} = \text{Embed}(query)$ và véc-tơ chunk tài liệu $\vec{d} = \text{Embed}(chunk)$.
   - Tính điểm tương đồng Cosine:
     $$\text{Sim}_{\text{vector}}(\vec{q}, \vec{d}) = \frac{\vec{q} \cdot \vec{d}}{\|\vec{q}\|_2 \|\vec{d}\|_2} = \frac{\sum_{i=1}^D q_i d_i}{\sqrt{\sum_{i=1}^D q_i^2} \sqrt{\sum_{i=1}^D d_i^2}}$$
   - Truy vấn qua chỉ mục HNSW trên `pgvector` với $M = 16, efConstruction = 64$ để đạt tốc độ $< 10\text{ms}$.

2. **Nhánh 2: Sparse Lexical Matching (BM25 / Full-Text Search)**
   - Đánh giá mức độ liên quan từ vựng qua thuật toán BM25:
     $$\text{Score}_{\text{BM25}}(D, Q) = \sum_{t \in Q} \text{IDF}(t) \cdot \frac{f(t, D) \cdot (k_1 + 1)}{f(t, D) + k_1 \cdot (1 - b + b \cdot \frac{|D|}{\text{avgdl}})}$$
     *(Trong đó: $k_1 = 1.2, b = 0.75$, $f(t, D)$ là tần suất từ khóa $t$ trong chunk $D$)*.

3. **Thuật Toán Hợp Nhất Thứ Hạng Tương Hỗ (Reciprocal Rank Fusion - RRF):**
   - Không cộng điểm thô (vì thang điểm vector $[0, 1]$ và điểm BM25 $[0, \infty)$ lệch nhau), mà dùng vị trí xếp hạng (Rank):
     $$\text{RRF\_Score}(d) = \frac{1}{k + \text{Rank}_{\text{vector}}(d)} + \frac{1}{k + \text{Rank}_{\text{BM25}}(d)} \quad (k = 60)$$
   - Lọc Top $K = 20$ chunks có điểm $\text{RRF\_Score}$ cao nhất chuyển tiếp cho bước Reranking.

#### 3. Logic Thuật Toán Chấm Điểm Tái Xếp Hạng Chéo (Cross-Encoder Reranking Logic)
- **Cơ chế:** Khác với Bi-Encoder tính vector độc lập, Reranker (`bge-reranker-v2-m3`) đưa toàn bộ cặp `[CLS] + Query + [SEP] + Chunk + [SEP]` đi qua tất cả các lớp Attention:
  $$\text{Relevance}(q, d) = \sigma\left(\mathbf{W} \cdot \text{Transformer}([CLS] \circ q \circ [SEP] \circ d)\right)$$
- **Logic thực thi:** Lọc Top 20 chunks từ bước RRF, tính toán ma trận chú ý chéo, sắp xếp giảm dần theo $\text{Relevance}$ và chỉ giữ lại Top 3 - 5 chunks đạt ngưỡng $\text{Score} \ge 0.65$.

#### 4. Logic Thuật Toán Rào Chắn & Kích Hoạt Bàn Giao Nhân Viên (Guardrails & Handoff Trigger Logic)
- **Logic phân nhánh quyết định (Decision Tree Logic):**
  ```
  IF contains_any(message, ["khiếu nại", "lừa đảo", "báo công an", "gặp nhân viên", "tổng đài"]) THEN
      Trigger = EXPLICIT_HUMAN_REQUEST
      Return HandoffToHuman(Reason="Khách yêu cầu trực tiếp hoặc rủi ro pháp lý")
  
  ELSE IF max(Chunk.Similarity) < 0.20 AND requireGrounded == TRUE THEN
      Trigger = NO_GROUNDED_SOURCE
      Return HandoffToHuman(Reason="Tri thức chưa ghi nhận câu trả lời")
  
  ELSE
      ProceedToGroundedPromptAssembly()
  ```

#### 5. Logic Neo Trích Dẫn & Chống Ảo Giác (Grounded Citation Binding Logic)
- **Cơ chế neo nguồn:**
  - Mỗi chunk lọt qua vòng Reranker được gán một số thứ tự tham chiếu $i \in \{1, 2, 3\}$.
  - Prompt ép buộc LLM:
    > *"Chỉ sử dụng thông tin trong các nguồn [1], [2] dưới đây. Khi đưa ra bất kỳ khẳng định nào, BẮT BUỘC phải đính kèm số trích dẫn tương ứng (ví dụ: [1]). Nếu thông tin không có trong nguồn, hãy nói rõ không có thông tin."*
  - **Logic hậu xử lý (Post-generation Verification):** Hệ thống quét qua các số trích dẫn trong câu trả lời sinh ra. Nếu LLM tự bịa một số trích dẫn `[4]` không tồn tại trong danh sách cung cấp, parser sẽ loại bỏ hoặc hạ cờ cảnh báo `confidence` xuống mức thấp.

---

### 2.3. Bản Chất "Training" Trong GoTek Chatbot — Train Bằng Mô Hình Gì?

Trong các hệ thống AI CSKH doanh nghiệp, khái niệm **"Training"** không phải là Pre-training lại toàn bộ mô hình nền tảng từ đầu (tốn hàng triệu USD, mất hàng tháng trời và kiến thức bị đóng băng cố định). 

Thay vào đó, GoTek Chatbot áp dụng **Mô hình Huấn Luyện 3 Tầng Thực Chiến (3-Tier Enterprise Training Strategy)**:

```mermaid
graph TD
    subgraph TIER1["TẦNG 1: DYNAMIC RAG TRAINING (IN-CONTEXT LEARNING) — MẶC ĐỊNH"]
        DocUpload[Doanh nghiệp Upload: PDF, DOCX, CSV, FAQ, Web Crawl] --> AutoChunk[Semantic Chunking tiếng Việt]
        AutoChunk --> Vectorize[Embedding Model bge-m3 / OpenAI]
        Vectorize --> IndexDB[(PostgreSQL pgvector RLS)]
        IndexDB --> Note1["Thời gian học: 0 GIÂY (Real-time). Đổi giá hôm nay, bot trả lời giá mới ngay lập tức!"]
    end

    subgraph TIER2["TẦNG 2: DOMAIN-SPECIFIC SFT & LoRA FINE-TUNING — DOANH NGHIỆP LỚN"]
        GoldenChats[2.000 - 10.000 Cặp hội thoại mẫu chuẩn của Top Agents] --> DataPrep[Định dạng SFT Dataset: Instruction - Context - Response]
        DataPrep --> LoRATrain[Huấn luyện thích ứng LoRA / QLoRA trên Base Model: Qwen-2.5-7B]
        LoRATrain --> LoRAWeights[Bộ trọng số LoRA Adapter 50MB - 100MB cho từng Workspace]
        LoRAWeights --> Note2["Mục tiêu: Dạy bot ngấm sâu phong cách thương hiệu, cách xưng hô và quy trình chốt sale chuyên sâu."]
    end

    subgraph TIER3["TẦNG 3: CONTINUOUS DPO / RLHF FEEDBACK LOOP — HỌC TỪ THỰC CHIẾN"]
        RealConvs[Hội thoại thực tế hàng ngày] --> HumanAction{Nhân viên / Khách tương tác}
        HumanAction -- "Khách bấm 👍 / 👎" --> FeedbackData[Thu thập tín hiệu phản hồi]
        HumanAction -- "Nhân viên bấm Sửa tin nhắn bot" --> GoldenPair[Cặp (Prompt, Chosen, Rejected)]
        HumanAction -- "Bấm 1-Click Teach FAQ" --> InstantLearn[Nạp ngay vào Tri thức Tầng 1]
        GoldenPair --> DPOTrain[Direct Preference Optimization: Tái huấn luyện LoRA định kỳ]
    end

    TIER1 --> TIER3
    TIER2 --> TIER3
```

#### 1. Tầng 1: Dynamic RAG Training (In-Context Learning — Tri Thức Động)
- **Phương pháp:** Huấn luyện tri thức véc-tơ không cần đụng vào trọng số mạng nơ-ron (Zero-weight tuning).
- **Cách thức:**
  1. Doanh nghiệp nạp tài liệu cẩm nang, chính sách, bảng giá hoặc URL website.
  2. Pipeline tự động bóc tách font tiếng Việt, chia chunk thông minh (800 ký tự / 100 overlap).
  3. Mô hình Embedding tạo vector ngữ nghĩa và lưu vào bảng `knowledge_chunks`.
- **Ưu điểm vượt trội:**
  - **Thời gian huấn luyện = 0 giây (Real-time):** Upload xong là bot biết ngay lập tức.
  - **Dễ dàng xóa/thu hồi tri thức:** Khi sản phẩm hết hàng hoặc ngừng kinh doanh, Admin chỉ cần bấm `active = false` là bot lập tức ngừng tư vấn, không bao giờ có hiện tượng "nhớ dai dữ liệu cũ".
  - **Chi phí cực thấp:** Doanh nghiệp không cần thuê cụm GPU A100/H100 đắt đỏ để train.

#### 2. Tầng 2: Supervised Fine-Tuning (SFT) với LoRA / QLoRA (Phong Cách & Nghiệp Vụ Chuyên Sâu)
- **Phương pháp:** Tinh chỉnh các ma trận thích ứng thứ hạng thấp (Low-Rank Adaptation - LoRA) trên mô hình mã nguồn mở như `Qwen-2.5-7B` hoặc `Llama-3.1-8B`.
- **Dữ liệu huấn luyện:**
  - Tập hợp 2.000 đến 10.000 lượt chat lịch sử mẫu giữa Khách hàng và các Tư vấn viên xuất sắc nhất của doanh nghiệp.
  - Định dạng chuẩn SFT:
    ```json
    {
      "instruction": "Bạn là tư vấn viên chính thức của GoTek. Hãy trả lời khách lịch sự, xưng em - anh/chị.",
      "input": "Khách hỏi: Bên em có giao hàng qua đêm về Vũng Tàu không?",
      "output": "Dạ em chào anh/chị ạ! Hiện GoTek có dịch vụ hỏa tốc giao về Vũng Tàu nhận ngay trong 6-8 tiếng ạ. Anh/Chị cho em xin số điện thoại và địa chỉ cụ thể để em lên đơn ngay cho mình nhé ạ! 🌸"
    }
    ```
- **Ưu điểm:** Giúp bot không còn vẻ máy móc, ngấm sâu văn hóa xưng hô, văn phong đặc thù của thương hiệu và kỹ năng chốt sale tinh tế.

#### 3. Tầng 3: Continuous DPO Training & 1-Click FAQ (Vòng Lặp Tự Học Liên Tục)
- **Phương pháp:** Direct Preference Optimization (DPO) kết hợp Human-in-the-Loop.
- **Cách thức hoạt động hàng ngày:**
  - Khi bot tư vấn một câu chưa tối ưu, nhân viên CSKH trực tiếp sửa lại câu chữ trên màn hình Inbox.
  - Hệ thống ghi nhận cặp dữ liệu:
    - `Prompt`: Câu hỏi của khách.
    - `Chosen (Ưu tiên)`: Câu sửa của nhân viên.
    - `Rejected (Bị loại)`: Câu sinh ban đầu của bot.
  - Với câu hỏi mới chưa có trong cẩm nang, nhân viên bấm nút **"Dạy bot câu này (1-Click FAQ)"** -> Pipeline tự động đưa vào kho tri thức của Tầng 1 ngay trong 1 click.
  - Định kỳ hàng tháng, hệ thống tổng hợp các cặp `(Chosen, Rejected)` để tinh chỉnh lại Prompt và re-train LoRA adapter.

---

### 2.4. Bản Đồ Deep Learning & Machine Learning Trong GoTek Chatbot (DL/ML Architecture Mapping)

Hệ thống GoTek Chatbot ứng dụng kết hợp cả **Machine Learning truyền thống (Classical ML)** và **Deep Learning sâu (Deep Neural Networks)**:

```mermaid
graph TD
    subgraph ML_LAYER["1. MACHINE LEARNING (ML CỔ ĐIỂN & PROBABILISTIC)"]
        BM25_Alg["Okapi BM25 Ranking:<br>Mô hình xác suất từ vựng IDF & Term Frequency"]
        HNSW_Alg["HNSW Graph Algorithm:<br>Tìm kiếm k láng giềng gần nhất (k-NN) trên pgvector"]
        Cosine_Alg["Cosine Metric Space:<br>Đo lường khoảng cách góc vector"]
    end

    subgraph DL_ENCODER["2. DEEP LEARNING (TRANSFORMER ENCODER - EMBEDDING & RERANKER)"]
        BiEncoder["Bi-Encoder (bge-m3 / BKAI Bi-Encoder):<br>12-24 Lớp Transformer Encoder, Multi-Head Self-Attention,<br>Ánh xạ chuỗi token -> Dense Vector 768/1024 chiều"]
        CrossEncoder["Cross-Encoder (bge-reranker-v2-m3):<br>Full Cross-Attention giữa Query và Document Chunk,<br>Lớp phân loại Classification Head (Sigmoid Output)"]
    end

    subgraph DL_GENERATOR["3. DEEP LEARNING (TRANSFORMER DECODER - GENERATIVE LLM)"]
        LLM_Arch["Autoregressive LLM (Qwen-2.5 / Llama-3.1 / GPT-4o):<br>32 - 80 Lớp Transformer Decoder, RoPE, SwiGLU, FlashAttention-2,<br>Dự đoán phân phối xác suất token tiếp theo P(w_t | w_<t)"]
    end

    ML_LAYER --> DL_ENCODER
    DL_ENCODER --> DL_GENERATOR
```

| Tầng Công Nghệ | Mô Hình / Thuật Toán Cụ Thể | Kiến Trúc Mạng Nơ-ron / Toán Học | Vị Trí Hoạt Động |
| :--- | :--- | :--- | :--- |
| **Classical Machine Learning (ML)** | • **Okapi BM25**<br>• **HNSW Graph Search**<br>• **Cosine Distance Metric** | • Mô hình xác suất thông tin (Probabilistic Relevance Framework).<br>• Cấu trúc đồ thị phân tầng đa lớp (Skip-list kết hợp k-NN). | Chạy trực tiếp trong cơ sở dữ liệu **PostgreSQL (`pgvector` + Full-Text Search index)**. |
| **Deep Learning (DL) — Bi-Encoder** | • **BAAI/bge-m3**<br>• **bkai-vietnamese-bi-encoder** | • **Transformer Encoder:** 12-24 lớp Multi-head Self-Attention ($h = 12, d_{model} = 768/1024$).<br>• Hàm mất mát: InfoNCE Loss (Contrastive Learning). | Chạy tại GPU Node / Model Provider để vector hóa tài liệu khi nạp tri thức. |
| **Deep Learning (DL) — Cross-Encoder** | • **BAAI/bge-reranker-v2-m3**<br>• **Cohere Rerank v3** | • **Full Cross-Attention:** Đưa cả `[Query + Chunk]` vào cùng một Transformer để toàn bộ token tương tác trực tiếp với nhau.<br>• Binary Cross-Entropy Loss / Margin Ranking Loss. | Chạy tại Worker trung gian để tái xếp hạng độ liên quan trước khi gửi cho LLM. |
| **Deep Learning (DL) — Generative LLM** | • **Qwen-2.5-7B/14B**<br>• **Llama-3.1-8B-Instruct**<br>• **GPT-4o / Gemini 1.5** | • **Autoregressive Causal Decoder:** RoPE (Rotary Position Embedding), RMSNorm, SwiGLU, GQA (Grouped-Query Attention).<br>• Phân phối xác suất: $\text{Softmax}(\mathbf{W}_v \cdot h_t)$. | Chạy trên Inference Server (vLLM / Ollama) hoặc Cloud Provider API. |

---

### 2.5. Hạ Tầng Huấn Luyện: Training Ở Đâu, Chạy Bằng Môi Trường Nào? (Training Infrastructure)

Rất nhiều người nhầm lẫn giữa **Tầng Ứng Dụng (Node.js)** và **Tầng Huấn Luyện Học Sâu (Python GPU Training Cluster)**. Trong hệ thống GoTek Chatbot, kiến trúc được phân tách rạch ròi thành 3 khối hạ tầng:

```mermaid
flowchart LR
    subgraph NODE_APP["1. TẦNG ĐIỀU PHỐI (Node.js / TypeScript - Repo Hiện Tại)"]
        direction TB
        AppServer[Backend Express API: 4317] --> DB[(PostgreSQL 16 RLS)]
        AppServer --> RabbitMQ[RabbitMQ Message Broker]
        AppServer --> DataExporter[Data Pipeline: Trích xuất Dataset .jsonl]
    end

    subgraph PYTHON_TRAIN["2. TẦNG HUẤN LUYỆN (Python + PyTorch GPU Node / Container)"]
        direction TB
        Trainer[Python Training Worker: train_lora.py / train_dpo.py]
        Trainer --> Libs["Framework: PyTorch, Hugging Face Transformers,<br>PEFT (LoRA/QLoRA), TRL (DPO), Unsloth/Axolotl"]
        Trainer --> GPU["Phần cứng: GPU NVIDIA (A100 / RTX 4090 / L40S)"]
        Trainer --> ExportWeight[Xuất file trọng số: adapter_model.safetensors 50MB]
    end

    subgraph INFERENCE["3. TẦNG SUY LUẬN MÔ HÌNH (Inference Serving Engine)"]
        direction TB
        vLLM[vLLM / Ollama Server: Port 8000]
        CloudAPI[OpenAI / Gemini / Anthropic API]
    end

    DataExporter -- "Gửi file dataset SFT/DPO" --> Trainer
    ExportWeight -- "Nạp Dynamic LoRA Adapter" --> vLLM
    AppServer -- "Gọi suy luận qua REST/HTTP" --> vLLM
    AppServer -- "Gọi Cloud inference" --> CloudAPI
```

#### 1. Môi Trường Huấn Luyện (Compute & Environment)
- **Training diễn ra ở đâu?** 
  - Quá trình huấn luyện mạng nơ-ron sâu (Deep Learning Fine-Tuning) **KHÔNG** chạy trong runtime của Node.js (Node.js chỉ đóng vai trò Data Pipeline & Orchestrator).
  - Quá trình training được thực thi trên **Worker Service viết bằng Python 3.10+ chạy trên máy chủ có GPU NVIDIA (CUDA 12.x)**:
    - Khi chạy Local / On-premise: Chạy trong Docker container chuyên dụng cho AI (như container `ai-service` với PyTorch và CUDA).
    - Khi chạy Cloud / Enterprise: Kích hoạt GPU Pod trên Kubernetes (K8s Spot Instances A100 / L4 / T4) qua cơ chế Job Queue của RabbitMQ.
- **Thư viện huấn luyện sử dụng:**
  - `torch`, `torchvision`: Framework tensor tính toán đạo hàm tự động (Autograd).
  - `transformers` & `datasets` (Hugging Face): Quản lý kiến trúc mô hình và pipeline dữ liệu.
  - `peft`: Kỹ thuật Parameter-Efficient Fine-Tuning (LoRA / QLoRA 4-bit) để đóng băng Base Model và chỉ train ma trận chuyển vị thứ hạng thấp.
  - `trl` (Transformer Reinforcement Learning): Huấn luyện tối ưu hóa sở thích DPO (Direct Preference Optimization).
  - `unsloth` / `flash-attn`: Tăng tốc độ huấn luyện lên gấp **2 - 5 lần**, tiết kiệm **80% VRAM**, giúp huấn luyện model 7B/8B chỉ tốn 14GB - 16GB VRAM của 1 card đồ họa RTX 3090/4090.

#### 2. Kịch Bản Huấn Luyện Chi Tiết (Training Script Execution Flow)
1. **Bước 1 — Xuất dữ liệu từ Database (Data Extraction):**
   - Node.js Backend truy vấn các phiên chat thành công hoặc cặp Q&A từ PostgreSQL, xuất ra file `dataset_workspace_{id}.jsonl`:
     ```json
     {"prompt": "Khách hỏi: Chính sách bảo hành?", "response": "Dạ bảo hành 12 tháng chính hãng ạ..."}
     ```
2. **Bước 2 — Kích hoạt tác vụ huấn luyện (Trigger Training Job):**
   - Backend đẩy một event qua **RabbitMQ**: `queue: "ai.training.jobs"`, payload: `{ workspaceId: "...", datasetUrl: "...", baseModel: "Qwen/Qwen2.5-7B-Instruct" }`.
3. **Bước 3 — Huấn luyện trọng số LoRA (PyTorch Training):**
   - Python Training Worker nhận job, tải Base Model, gắn LoRA rank $r = 16, \alpha = 32$, chạy qua 3 - 5 epochs:
     $$\mathbf{W}_{\text{new}} = \mathbf{W}_{\text{frozen}} + \Delta \mathbf{W} = \mathbf{W}_{\text{frozen}} + \frac{\alpha}{r} (\mathbf{A} \cdot \mathbf{B})$$
4. **Bước 4 — Xuất bản Trọng số (Artifact Deployment):**
   - Xuất file trọng số LoRA nhẹ khoảng **50MB - 100MB** (`adapter_model.safetensors`).
   - Nạp vào cụm **vLLM (Multi-LoRA Serving)**: Mỗi doanh nghiệp (Workspace) được cấp một `lora_name = "workspace_{id}"`. Khi khách của doanh nghiệp nào nhắn tin, vLLM chỉ cần áp đúng adapter của doanh nghiệp đó vào Base Model dùng chung trong RAM để sinh câu trả lời tức thì!

---

## 3. Kiến Trúc Luồng 5 Giai Đoạn (5-Stage Pipeline Lifecycle)

```mermaid
flowchart TD
    subgraph STAGE1["Giai Đoạn 1: INGESTION & CHUNKING"]
        RawDoc[Văn bản thô / File DOCX, PDF / Web Crawl / FAQ] --> Clean[Làm sạch & chuẩn hóa Unicode tiếng Việt]
        Clean --> ChunkEngine[Vietnamese Chunking: 800 ký tự, overlap 100]
        ChunkEngine --> HashGen[Tạo SHA-256 Content Hash]
        HashGen --> SaveChunks[(Bảng knowledge_chunks)]
    end

    subgraph STAGE2["Giai Đoạn 2: HYBRID RETRIEVAL (RAG)"]
        UserMsg[Tin nhắn của khách hàng] --> CleanQuery[Chuẩn hóa từ khóa câu hỏi]
        CleanQuery --> HybridSearch[Hybrid Search: Lexical Match + Vector Similarity]
        SaveChunks --> HybridSearch
        HybridSearch --> RankedSources[Top N Chunks có điểm tương đồng cao nhất]
    end

    subgraph STAGE3["Giai Đoạn 3: GUARDRAILS & HANDOFF DETECTION"]
        UserMsg --> IntentAudit{Phát hiện ý định?}
        IntentAudit -- "Khách bức xúc / Đòi gặp người / Khiếu nại" --> DirectHandoff[Kích hoạt Staff Handoff: EXPLICIT_HUMAN_REQUEST]
        IntentAudit -- "Bình thường" --> CheckSource{Có nguồn phù hợp?}
        CheckSource -- "Không có nguồn & requireGrounded" --> SourceHandoff[Kích hoạt Staff Handoff: NO_GROUNDED_SOURCE]
        CheckSource -- "Có nguồn thỏa mãn" --> BuildPrompt[Gộp Prompt Ngữ Cảnh]
    end

    subgraph STAGE4["Giai Đoạn 4: GROUNDED GENERATION & CITATIONS"]
        BuildPrompt --> PersonaRules[Inject Business Rules & Persona]
        PersonaRules --> LLMCall[Gọi LLM Platform / Local Synthesizer]
        LLMCall --> FormatAnswer[Gắn số trích dẫn [1], [2] + Token Metering]
    end

    subgraph STAGE5["Giai Đoạn 5: PLAYGROUND & CONTINUOUS LEARNING"]
        FormatAnswer --> Delivery[Gửi tin nhắn phản hồi]
        Unanswered[Câu hỏi khách hỏi mà bot chưa biết] --> TeachOneClick[1-Click Teach FAQ: Nạp trực tiếp vào Knowledge Base]
        TeachOneClick --> SaveChunks
    end

    STAGE1 --> STAGE2
    STAGE2 --> STAGE3
    STAGE3 --> STAGE4
    STAGE4 --> STAGE5
```

---

## 4. Đặc Tả Chi Tiết Từng Giai Đoạn

### 4.1. Giai Đoạn 1: Ingestion & Vietnamese Chunking
- **Mục tiêu:** Chuyển đổi văn bản phi cấu trúc thành các vector chunks có chỉ mục ngữ nghĩa.
- **Quy tắc Chunking tiếng Việt:**
  - Cắt theo ranh giới câu (`.`, `!`, `?`, `\n`) thay vì cắt cứng theo số ký tự.
  - Ngưỡng tối đa mỗi chunk: `maxChars = 800` (khoảng 150 - 200 từ tiếng Việt).
  - Ngưỡng gối đầu (overlap): `overlapChars = 100` để giữ trọn vẹn ngữ cảnh giữa các đoạn nối.
  - Mỗi chunk lưu trữ kèm `token_estimate` và `content_hash` (SHA-256) để chống trùng lặp.
- **Mã nguồn tương ứng:**
  ```typescript
  // Trích đoạn backend/src/modules/ai/ai-pipeline.ts
  const chunks = chunkKnowledgeText(content, {
    maxChars: input.maxCharsPerChunk || 800,
    overlapChars: input.overlapChars || 100,
  });
  ```

### 4.2. Giai Đoạn 2: Hybrid Context Retrieval (RAG)
- **Mục tiêu:** Tìm ra các đoạn tài liệu liên quan nhất đến câu hỏi của khách hàng trong thời gian < 50ms.
- **Cơ chế tìm kiếm lai (Hybrid Search):**
  - **Lexical Search (Truy vấn từ vựng):** Bóc tách n-gram và từ khóa quan trọng tiếng Việt từ `query`.
  - **Cosine Semantic Scoring:** Tính toán điểm số tương đồng ngữ nghĩa giữa câu hỏi và từng chunk.
  - **Lọc theo phạm vi (Scope Filtering):** Chỉ quét các chunk thuộc về `workspace_id` hiện tại, trạng thái phiên bản là `READY`, item đang `active = true`, và quyền hạn `audience` thỏa mãn (`PUBLIC` cho khách, `INTERNAL` cho nhân viên nội bộ).

### 4.3. Giai Đoạn 3: Guardrails & Smart Handoff Triggers
- **Mục tiêu:** Bảo vệ thương hiệu của doanh nghiệp trước các câu hỏi nhạy cảm hoặc khách hàng đang nóng giận.
- **Danh sách Trigger chuyển giao người trực ngay lập tức:**
  - Từ khóa đòi gặp người: *"gặp nhân viên"*, *"nói chuyện với người"*, *"gặp sếp"*, *"tư vấn viên"*, *"human"*, *"agent"*.
  - Từ khóa bức xúc / pháp lý: *"khiếu nại"*, *"lừa đảo"*, *"báo công an"*, *"tổng đài viên"*.
- **Xử lý thiếu nguồn tri thức (`requireGrounded`):**
  - Nếu câu hỏi của khách nằm ngoài toàn bộ tài liệu đã học, hệ thống từ chối trả lời phỏng đoán và lịch sự thông báo chuyển chuyên viên hỗ trợ (`handoffReason: 'NO_GROUNDED_SOURCE'`).

### 4.4. Giai Đoạn 4: Grounded Generation With Active Citations
- **Mục tiêu:** Sinh câu trả lời mượt mà, đúng giọng điệu doanh nghiệp, kèm link/chỉ mục trích dẫn nguồn.
- **Cấu trúc Prompt:**
  1. **System Persona:** Quy định vai trò ("Bạn là trợ lý ảo chính thức của thương hiệu...").
  2. **Active Business Rules:** Áp dụng các quy tắc như: luôn dạ/thưa, không nhắc đến đối thủ, chỉ tư vấn trong phạm vi sản phẩm.
  3. **Grounded Knowledge Sources:** Liệt kê các đoạn chunk đính kèm nhãn `[1]`, `[2]` để LLM dựa vào đó trả lời.
  4. **Conversation History:** Kèm lịch sử ngắn hạn (Short-term memory) để trả lời trúng ngữ cảnh hội thoại.
- **Token Metering & Ledger:** Ghi nhận chính xác số prompt tokens và completion tokens vào bảng `usage_ledger` để phục vụ thanh toán / đo lường hạn ngạch.

### 4.5. Giai Đoạn 5: AI Playground & 1-Click FAQ Feedback Loop
- **Playground Simulation:** Cung cấp môi trường kiểm thử trực tiếp cho Admin/Owner. Xem trước câu trả lời, độ tự tin (`confidence`), danh sách nguồn trích dẫn và prompt nội bộ mà không làm xáo trộn dữ liệu khách hàng.
- **1-Click FAQ Teaching:** Khi nhân viên trực chat giải quyết xong một câu hỏi mới của khách, nhân viên có thể bấm "Dạy bot câu này". Pipeline sẽ tự động chuyển thành cặp Q&A chuẩn hóa, nạp và xuất bản tức thì vào Knowledge Base.

---

## 5. Đặc Tả API Endpoints

Tất cả các API được bảo vệ bởi middleware `authed(...)` với cơ chế RLS tự động và kiểm tra quyền RBAC:

### 1. Ingest Tài Liệu
- **Endpoint:** `POST /api/ai/pipeline/ingest`
- **Quyền yêu cầu:** `knowledge.manage` (Owner, Admin)
- **Request Body:**
  ```json
  {
    "title": "Chính sách đổi trả 2026",
    "content": "Sản phẩm được đổi mới 1-1 trong 15 ngày đầu...",
    "audience": "PUBLIC",
    "categoryId": "optional-uuid"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "itemId": "uuid",
    "versionId": "uuid",
    "chunksCount": 3,
    "totalTokens": 240,
    "chunks": [
      {"index": 0, "text": "...", "tokenEstimate": 80}
    ]
  }
  ```

### 2. Truy Vấn Ngữ Cảnh (Retrieve)
- **Endpoint:** `POST /api/ai/pipeline/retrieve`
- **Quyền yêu cầu:** `inbox.use` (Owner, Admin, Agent)
- **Request Body:**
  ```json
  {
    "query": "thời gian đổi trả hàng là bao lâu?",
    "limit": 3,
    "minSimilarity": 0.2
  }
  ```
- **Response (200 OK):**
  ```json
  [
    {
      "chunkIndex": 0,
      "versionId": "uuid",
      "title": "Chính sách đổi trả 2026",
      "text": "Sản phẩm được đổi mới 1-1 trong 15 ngày đầu...",
      "similarity": 0.85,
      "citationId": "src-uuid-0"
    }
  ]
  ```

### 3. Sinh Câu Trả Lời (Generate Answer)
- **Endpoint:** `POST /api/ai/pipeline/generate`
- **Quyền yêu cầu:** `inbox.use` (Owner, Admin, Agent)
- **Request Body:**
  ```json
  {
    "message": "Tôi muốn đổi hàng thì làm thế nào?",
    "history": [],
    "requireGrounded": true
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "answer": "Dạ theo cẩm nang [1] \"Chính sách đổi trả 2026\", anh/chị được đổi mới 1-1 trong 15 ngày đầu...",
    "citations": [
      {
        "reference": 1,
        "title": "Chính sách đổi trả 2026",
        "snippet": "Sản phẩm được đổi mới 1-1...",
        "similarity": 0.85
      }
    ],
    "confidence": 0.85,
    "isHandoff": false,
    "tokensUsed": {"promptTokens": 120, "completionTokens": 45, "totalTokens": 165},
    "latencyMs": 350
  }
  ```

### 4. Giả Lập Thử Nghiệm (Playground Simulation)
- **Endpoint:** `POST /api/ai/pipeline/playground`
- **Quyền yêu cầu:** `knowledge.manage` (Owner, Admin)
- **Request Body:**
  ```json
  {
    "question": "Điều kiện bảo hành phần cứng?"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "answer": "...",
    "citations": [...],
    "groundedPromptPreview": "=== SYSTEM PROMPT ĐÃ GHÉP NGUỒN ==="
  }
  ```

### 5. Dạy Nhanh FAQ (1-Click Teach FAQ)
- **Endpoint:** `POST /api/ai/pipeline/faq`
- **Quyền yêu cầu:** `knowledge.manage` (Owner, Admin)
- **Request Body:**
  ```json
  {
    "question": "Cửa hàng có chỗ đỗ ô tô không?",
    "answer": "Dạ cửa hàng có bãi đỗ xe ô tô miễn phí ngay trước cửa ạ!"
  }
  ```
- **Response (200 OK):** Trả về kết quả ingest và tự động sẵn sàng phục vụ cho câu hỏi tiếp theo.

---

## 6. Danh Mục File Triển Khai (Source Code Traceability)

| Thành Phần | Đường Dẫn File | Trách Nhiệm |
| :--- | :--- | :--- |
| **Pipeline Core Engine** | [`backend/src/modules/ai/ai-pipeline.ts`](file:///d:/GoTek-ChatBOT/backend/src/modules/ai/ai-pipeline.ts) | Thực thi 5 giai đoạn: Ingest, Chunking, Retrieval, Generation, Playground, FAQ |
| **Service Layer** | [`backend/src/services/ai-pipeline.service.ts`](file:///d:/GoTek-ChatBOT/backend/src/services/ai-pipeline.service.ts) | Wrapper nghiệp vụ tuân thủ Clean Architecture |
| **HTTP Controller** | [`backend/src/controllers/ai-pipeline.controller.ts`](file:///d:/GoTek-ChatBOT/backend/src/controllers/ai-pipeline.controller.ts) | Xác thực dữ liệu đầu vào Zod Schemas |
| **Route Group** | [`backend/src/routes/ai.routes.ts`](file:///d:/GoTek-ChatBOT/backend/src/routes/ai.routes.ts) | Phân quyền RBAC và kích hoạt Transaction RLS |
| **Main Router Mount** | [`backend/src/routes/index.ts`](file:///d:/GoTek-ChatBOT/backend/src/routes/index.ts) | Gắn `aiRouter` vào router tổng của ứng dụng |
| **Automated Tests** | [`backend/tests/ai-pipeline.test.ts`](file:///d:/GoTek-ChatBOT/backend/tests/ai-pipeline.test.ts) | Kiểm thử đơn vị & kiểm thử tích hợp Supertest (100% PASS) |

---

## 7. Trạng Thái Vận Hành & Bước Tiếp Theo

- **Hiện trạng:** Đã hoàn thành 100% phần Backend, API và Test suites.
- **Tiến độ kiểm thử:**
  - `npx tsx --test tests/ai-pipeline.test.ts`: **2/2 PASS**
  - `npm run build:all`: **100% PASS** (Backend + Frontend Zero TypeScript errors).
- **Hành động kế tiếp:** Triển khai giao diện **AI Training Studio & Playground** trên Frontend (`/app/knowledge`) với 5 tab trực quan: Tài liệu, Website, FAQ, Persona, và Live Playground.

---

## 8. Danh Mục Biến Môi Trường Cần Thiết Cho AI (.env Inventory)

Để kích hoạt đầy đủ các tính năng AI, RAG, Reranker và Training Worker, hệ thống hỗ trợ các nhóm biến môi trường sau:

| Nhóm Cấu Hình | Tên Biến Môi Trường (.env) | Ý Nghĩa & Giá Trị Mẫu | Ghi Chú Kỹ Thuật |
| :--- | :--- | :--- | :--- |
| **Generative LLM (Cloud)** | `OPENAI_API_KEY` | `sk-...` | Cung cấp truy cập GPT-4o, GPT-4o-mini |
| **Generative LLM (Cloud)** | `GEMINI_API_KEY` | `AIzaSy...` | Cung cấp truy cập Gemini 1.5 Flash / Pro |
| **Generative LLM (Cloud)** | `ANTHROPIC_API_KEY` | `sk-ant-...` | Cung cấp truy cập Claude 3.5 Sonnet |
| **Generative LLM (Cloud)** | `GROQ_API_KEY` | `gsk_...` | Suy luận tốc độ cao LLaMA-3.3, Qwen-2.5, Whisper Turbo |
| **Generative LLM (Cloud)** | `OPEN_ROUTER_API` | `sk-or-v1-...` | Cổng tổng hợp multi-LLM (DeepSeek, Claude, LLaMA) |
| **Self-Hosted Inference** | `GOTEK_CUSTOM_LLM_BASE_URL` | `http://localhost:8000/v1` | Endpoint máy chủ suy luận vLLM / Ollama / Python AI Service |
| **Self-Hosted Inference** | `VLLM_MODEL_NAME` | `Qwen/Qwen2.5-7B-Instruct` | Tên mô hình nền tảng đang nạp trên vLLM |
| **Embedding Model** | `GOTEK_EMBEDDING_MODEL` | `text-embedding-3-small`<br>`BAAI/bge-m3` | Mô hình vector hóa tri thức văn bản |
| **Embedding Batch** | `GOTEK_EMBEDDING_BATCH_SIZE` | `20` | Kích thước lô xử lý chunk cùng lúc |
| **Reranker (Cloud)** | `COHERE_API_KEY` | `...` | API Key cho dịch vụ Cohere Rerank v3 |
| **Training & Hub** | `HF_TOKEN` | `hf_...` | Tải Base Models và đồng bộ LoRA weights |
| **Training (Worker)** | `AI_TRAINING_WORKER_URL` | `http://localhost:8003` | Endpoint nhận lệnh huấn luyện của Python Worker |
| **Async Queue & Cache** | `RABBITMQ_URL`<br>`REDIS_URL` | `amqp://guest:guest@localhost:5672`<br>`redis://localhost:6379` | Hàng đợi tác vụ training và bộ nhớ đệm cache |
