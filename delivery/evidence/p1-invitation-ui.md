# Invitation UI inspection — 2026-09-24
Local runtime HTTP health confirmed, no restart. IAB opened http://127.0.0.1:4317/app/invitation; browser accessibility readback shows Gotek logo, heading Nhận lời mời, and missing-link message: Liên kết lời mời không đầy đủ. Vui lòng yêu cầu quản trị viên gửi lại.

This proves missing-link rendering only. Successful authenticated acceptance, expired/revoked/wrong-account UI, mobile geometry and HiChat comparison remain NOT RUN. Backend acceptance/wrong-account and membership switch covered in real PostgreSQL integration suite. Source visual fidelity remains G001.
