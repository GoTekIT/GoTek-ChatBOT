import hashlib
import time
from typing import Optional, Dict, Any, List

class SHA256ImageCache:
    """
    In-memory LRU/TTL cache keyed by SHA-256 hash of image bytes and workspace/tenant ID.
    Prevents repeated OCR inference for identical documents or receipts.
    """
    def __init__(self, ttl_seconds: int = 3600, max_size: int = 500):
        self.ttl = ttl_seconds
        self.max_size = max_size
        self.cache: Dict[str, Dict[str, Any]] = {}

    def _hash_key(self, images_bytes: List[bytes], tenant_id: str = "default") -> str:
        hasher = hashlib.sha256()
        hasher.update(tenant_id.encode("utf-8"))
        for img in images_bytes:
            hasher.update(img)
        return hasher.hexdigest()

    def get(self, images_bytes: List[bytes], tenant_id: str = "default") -> Optional[Dict[str, Any]]:
        key = self._hash_key(images_bytes, tenant_id)
        entry = self.cache.get(key)
        if not entry:
            return None
        if time.time() - entry["timestamp"] > self.ttl:
            del self.cache[key]
            return None
        return entry["data"]

    def set(self, images_bytes: List[bytes], data: Dict[str, Any], tenant_id: str = "default"):
        if len(self.cache) >= self.max_size:
            now = time.time()
            expired_keys = [k for k, v in self.cache.items() if now - v["timestamp"] > self.ttl]
            for k in expired_keys:
                del self.cache[k]
            if len(self.cache) >= self.max_size:
                oldest_key = min(self.cache.keys(), key=lambda k: self.cache[k]["timestamp"])
                del self.cache[oldest_key]

        key = self._hash_key(images_bytes, tenant_id)
        self.cache[key] = {
            "timestamp": time.time(),
            "data": data
        }

# Global singleton instance for OCR caching in GoTek Chatbot
document_cache = SHA256ImageCache()
