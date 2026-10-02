import os
import sys
import time
import threading
from typing import Dict, Any, List, Optional
from datetime import datetime

class TrainingManager:
    """
    Singleton Manager for tracking AI Training Jobs, Metrics, Losses, and Hardware State.
    Thread-safe progress updates for REST API polling.
    """
    _instance = None
    _lock = threading.RLock()

    def __new__(cls):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super().__new__(cls)
                cls._instance._init_state()
            return cls._instance

    def _init_state(self):
        self.job_id: Optional[str] = None
        self.status: str = "IDLE"  # IDLE, PREPARING, TRAINING, EVALUATING, COMPLETED, FAILED, STOPPED
        self.model_name: str = "Qwen/Qwen2.5-1.5B-Instruct"
        self.dataset_path: str = ""
        self.start_time: Optional[float] = None
        self.end_time: Optional[float] = None
        self.current_step: int = 0
        self.total_steps: int = 0
        self.current_epoch: int = 0
        self.total_epochs: int = 0
        self.progress_pct: float = 0.0
        self.current_loss: Optional[float] = None
        self.best_loss: Optional[float] = None
        self.loss_history: List[Dict[str, Any]] = []
        self.logs: List[str] = []
        self.error: Optional[str] = None
        self.checkpoint_dir: str = ""
        self.stop_requested: bool = False
        self._thread: Optional[threading.Thread] = None
        self._cached_hw: Optional[Dict[str, Any]] = None

    def start_job(self, job_id: str, model_name: str, total_epochs: int, total_steps: int, dataset_path: str, checkpoint_dir: str):
        with self._lock:
            self.job_id = job_id
            self.status = "PREPARING"
            self.model_name = model_name
            self.dataset_path = dataset_path
            self.checkpoint_dir = checkpoint_dir
            self.total_epochs = total_epochs
            self.total_steps = total_steps
            self.current_step = 0
            self.current_epoch = 0
            self.progress_pct = 0.0
            self.current_loss = None
            self.best_loss = None
            self.loss_history = []
            self.logs = []
            self.error = None
            self.stop_requested = False
            self.start_time = time.time()
            self.end_time = None
            self.log(f"Khởi động tác vụ huấn luyện [{job_id}] - Model: {model_name} - Epochs: {total_epochs}")

    def update_progress(self, current_step: int, current_epoch: int, loss: float, lr: Optional[float] = None):
        with self._lock:
            self.status = "TRAINING"
            self.current_step = current_step
            self.current_epoch = current_epoch
            self.current_loss = round(loss, 4)
            if self.best_loss is None or loss < self.best_loss:
                self.best_loss = round(loss, 4)

            if self.total_steps > 0:
                self.progress_pct = round(min(100.0, (current_step / self.total_steps) * 100.0), 2)

            point = {
                "step": current_step,
                "epoch": current_epoch,
                "loss": round(loss, 4),
                "learning_rate": lr,
                "timestamp": round(time.time(), 2)
            }
            self.loss_history.append(point)
            if len(self.loss_history) > 500:
                self.loss_history = self.loss_history[-500:]

    def log(self, message: str):
        timestamp = datetime.now().strftime("%H:%M:%S")
        formatted = f"[{timestamp}] {message}"
        print(formatted, flush=True)
        with self._lock:
            self.logs.append(formatted)
            if len(self.logs) > 300:
                self.logs.pop(0)

    def complete_job(self, checkpoint_path: str):
        with self._lock:
            self.status = "COMPLETED"
            self.progress_pct = 100.0
            self.end_time = time.time()
            self.checkpoint_dir = checkpoint_path
            self.log(f"Hoàn tất huấn luyện thành công! Checkpoint lưu tại: {checkpoint_path}")

    def fail_job(self, error_message: str):
        with self._lock:
            self.status = "FAILED"
            self.error = error_message
            self.end_time = time.time()
            self.log(f"LỖI HUẤN LUYỆN: {error_message}")

    def request_stop(self):
        with self._lock:
            self.stop_requested = True
            self.status = "STOPPED"
            self.end_time = time.time()
            self.log("Đã nhận yêu cầu dừng huấn luyện từ người dùng.")

    def get_hardware_info(self) -> Dict[str, Any]:
        """Check hardware, CUDA GPU and VRAM availability with zero-lag response."""
        if hasattr(self, "_cached_hw") and self._cached_hw is not None:
            return self._cached_hw

        info = {
            "cuda_available": False,
            "device": "CPU",
            "total_vram_gb": 0.0,
            "allocated_vram_gb": 0.0,
            "free_vram_gb": 0.0,
            "note": "CUDA GPU not active. Training will run in CPU mode or utilize cloud worker."
        }

        if "torch" in sys.modules:
            try:
                torch_mod = sys.modules["torch"]
                if hasattr(torch_mod, "cuda") and torch_mod.cuda.is_available():
                    device_name = torch_mod.cuda.get_device_name(0)
                    total_vram = round(torch_mod.cuda.get_device_properties(0).total_memory / (1024**3), 2)
                    allocated_vram = round(torch_mod.cuda.memory_allocated(0) / (1024**3), 2)
                    cached_vram = round(torch_mod.cuda.memory_reserved(0) / (1024**3), 2)
                    info = {
                        "cuda_available": True,
                        "device": device_name,
                        "total_vram_gb": total_vram,
                        "allocated_vram_gb": allocated_vram,
                        "cached_vram_gb": cached_vram,
                        "free_vram_gb": round(total_vram - allocated_vram, 2),
                        "cuda_version": getattr(torch_mod.version, "cuda", "N/A")
                    }
            except Exception:
                pass

        self._cached_hw = info
        return self._cached_hw

    def get_status_payload(self) -> Dict[str, Any]:
        hw = self.get_hardware_info()
        with self._lock:
            elapsed_seconds = 0
            if self.start_time:
                end = self.end_time or time.time()
                elapsed_seconds = round(end - self.start_time, 1)

            eta_seconds = None
            if self.status == "TRAINING" and self.progress_pct > 0 and elapsed_seconds > 0:
                total_estimated = elapsed_seconds / (self.progress_pct / 100.0)
                eta_seconds = max(0, round(total_estimated - elapsed_seconds, 1))

            return {
                "job_id": self.job_id,
                "status": self.status,
                "model_name": self.model_name,
                "progress_percentage": self.progress_pct,
                "current_epoch": self.current_epoch,
                "total_epochs": self.total_epochs,
                "current_step": self.current_step,
                "total_steps": self.total_steps,
                "current_loss": self.current_loss,
                "best_loss": self.best_loss,
                "elapsed_seconds": elapsed_seconds,
                "eta_seconds": eta_seconds,
                "error": self.error,
                "checkpoint_dir": self.checkpoint_dir,
                "recent_logs": list(self.logs[-20:]),
                "loss_curve_points": list(self.loss_history[-50:]),
                "hardware": hw
            }

training_manager = TrainingManager()
