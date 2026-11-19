import threading
import time
from collections import OrderedDict
from typing import Any, Callable, Generic, Optional, TypeVar

T = TypeVar("T")


class TTLCache(Generic[T]):
    """
    Lightweight thread-safe in-memory TTL + LRU cache.
    Avoids redundant SQL roundtrips for slow-changing ERP catalogs and config.
    """

    def __init__(self, default_ttl: float = 300.0, max_size: int = 256):
        self.default_ttl = float(default_ttl)
        self.max_size = max(1, int(max_size))
        self._lock = threading.Lock()
        self._store: "OrderedDict[str, tuple[float, Any]]" = OrderedDict()

    def get(self, key: str) -> Optional[T]:
        now = time.monotonic()
        with self._lock:
            entry = self._store.get(key)
            if entry is None:
                return None
            expires_at, val = entry
            if now >= expires_at:
                self._store.pop(key, None)
                return None
            self._store.move_to_end(key)
            return val

    def set(self, key: str, value: T, ttl: Optional[float] = None) -> None:
        effective_ttl = self.default_ttl if ttl is None else float(ttl)
        expires_at = time.monotonic() + effective_ttl
        with self._lock:
            self._store[key] = (expires_at, value)
            self._store.move_to_end(key)
            while len(self._store) > self.max_size:
                self._store.popitem(last=False)

    def get_or_set(
        self,
        key: str,
        loader: Callable[[], T],
        ttl: Optional[float] = None,
        cache_empty: bool = True,
    ) -> T:
        cached = self.get(key)
        if cached is not None:
            return cached
        val = loader()
        if val is not None and (cache_empty or bool(val)):
            self.set(key, val, ttl=ttl)
        return val

    def invalidate(self, prefix: Optional[str] = None) -> None:
        with self._lock:
            if not prefix:
                self._store.clear()
                return
            for k in [k for k in self._store.keys() if k.startswith(prefix)]:
                self._store.pop(k, None)
