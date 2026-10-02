import os
import uuid
import threading
import time
from typing import Optional, Dict, Any
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from services.training_manager import training_manager

router = APIRouter(prefix="/v1/training", tags=["AI Training & Fine-Tuning Monitor"])

class StartTrainingRequest(BaseModel):
    model_name: Optional[str] = Field("Qwen/Qwen2.5-1.5B-Instruct", description="Hugging Face model ID")
    epochs: Optional[int] = Field(3, ge=1, le=20, description="Number of training epochs")
    batch_size: Optional[int] = Field(2, ge=1, le=64, description="Per-device train batch size")
    learning_rate: Optional[float] = Field(2e-4, ge=1e-6, le=1e-2, description="LoRA learning rate")
    dataset_path: Optional[str] = Field("dataset/processed/cskh_seed_dataset_50.jsonl", description="Path to processed JSONL dataset")
    output_dir: Optional[str] = Field("models/gotek-cskh-lora", description="Output directory for LoRA checkpoints")
    use_mock_simulation: Optional[bool] = Field(False, description="If True, simulates training steps for testing health check API without GPU")

@router.get("/health")
@router.get("/status")
async def get_training_status():
    """
    Real-time Health Check & Progress Monitor for AI Fine-Tuning.
    Returns current training stage, step progress, loss curves, ETA, and GPU VRAM usage.
    """
    return {
        "service": "gotek-ai-training-worker",
        "timestamp": time.time(),
        **training_manager.get_status_payload()
    }

@router.get("/logs")
async def get_training_logs():
    """
    Retrieve real-time streaming logs from the training execution engine.
    """
    return {
        "job_id": training_manager.job_id,
        "status": training_manager.status,
        "logs_count": len(training_manager.logs),
        "logs": training_manager.logs
    }

def _run_training_worker_background(params: StartTrainingRequest, job_id: str):
    """Worker background execution loop (Real LoRA or Mock simulation)"""
    try:
        if params.use_mock_simulation:
            total_steps = (params.epochs or 3) * 50
            training_manager.start_job(
                job_id=job_id,
                model_name=params.model_name or "Qwen/Qwen2.5-1.5B-Instruct",
                total_epochs=params.epochs or 3,
                total_steps=total_steps,
                dataset_path=params.dataset_path or "",
                checkpoint_dir=params.output_dir or "models/gotek-cskh-lora"
            )

            sim_loss = 2.45
            for epoch in range(1, (params.epochs or 3) + 1):
                training_manager.log(f"--- Bắt đầu Epoch {epoch}/{params.epochs} ---")
                for step in range(1, 51):
                    if training_manager.stop_requested:
                        training_manager.log("Đã dừng tiến trình huấn luyện an toàn.")
                        return

                    time.sleep(0.05)
                    global_step = (epoch - 1) * 50 + step
                    sim_loss = max(0.28, sim_loss * 0.985 + (0.01 * (0.5 - (step % 3) * 0.1)))
                    training_manager.update_progress(
                        current_step=global_step,
                        current_epoch=epoch,
                        loss=sim_loss,
                        lr=params.learning_rate
                    )

                    if step % 10 == 0:
                        training_manager.log(f"Epoch {epoch} | Step {global_step}/{total_steps} | Loss: {sim_loss:.4f} | LR: {params.learning_rate}")

            checkpoint_path = os.path.abspath(params.output_dir or "models/gotek-cskh-lora")
            os.makedirs(checkpoint_path, exist_ok=True)
            training_manager.complete_job(checkpoint_path)
        else:
            from train_lora import run_lora_training
            run_lora_training(
                model_name=params.model_name or "Qwen/Qwen2.5-1.5B-Instruct",
                dataset_path=params.dataset_path or "dataset/processed/cskh_seed_dataset_50.jsonl",
                output_dir=params.output_dir or "models/gotek-cskh-lora",
                epochs=params.epochs or 3,
                batch_size=params.batch_size or 2,
                learning_rate=params.learning_rate or 2e-4,
                push_to_hub=True,
                job_id=job_id
            )

    except Exception as exc:
        training_manager.fail_job(str(exc))

@router.post("/start")
async def start_training_job(request: StartTrainingRequest):
    """
    Start an asynchronous AI Fine-Tuning Job.
    Runs in background and updates real-time status visible via /v1/training/status.
    """
    if training_manager.status in ["TRAINING", "PREPARING"]:
        raise HTTPException(
            status_code=409,
            detail=f"Một tác vụ huấn luyện ({training_manager.job_id}) đang diễn ra. Vui lòng đợi hoàn tất hoặc gửi yêu cầu dừng."
        )

    job_id = f"job-train-{uuid.uuid4().hex[:8]}"
    t = threading.Thread(target=_run_training_worker_background, args=(request, job_id), daemon=True)
    t.start()

    return {
        "status": "ACCEPTED",
        "message": "Đã tiếp nhận và khởi động tiến trình huấn luyện ngầm",
        "job_id": job_id,
        "model_name": request.model_name,
        "epochs": request.epochs,
        "monitor_url": "/v1/training/status",
        "health_url": "/health"
    }

@router.post("/stop")
async def stop_training_job():
    """
    Request graceful cancellation of the active training job.
    """
    if training_manager.status not in ["TRAINING", "PREPARING"]:
        return {"status": "NOOP", "message": "Hiện tại không có tác vụ huấn luyện nào đang chạy."}

    training_manager.request_stop()
    return {
        "status": "STOP_REQUESTED",
        "job_id": training_manager.job_id,
        "message": "Đã gửi tín hiệu dừng tiến trình huấn luyện."
    }
