# GoTek CSKH LoRA Adapter (Qwen/Qwen2.5-1.5B-Instruct)

Mô hình LoRA Fine-Tuning phục vụ hệ thống chăm sóc khách hàng đa kênh GoTek Chatbot.

- **Base Model**: `Qwen/Qwen2.5-1.5B-Instruct`
- **Epochs**: `3`
- **Best Training Loss**: `1.2746`
- **Dataset**: `cskh_seed_dataset_50.jsonl`
- **Target Modules**: `q_proj, k_proj, v_proj, o_proj, gate_proj, up_proj, down_proj`
- **Tác giả / Tổ chức**: GoTek Team (namnv1409)
