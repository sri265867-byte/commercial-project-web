"""
Rate limiter for Kie.ai API.
Limit: 20 requests per 10 seconds (per account).

When the limit is hit, requests wait in queue until a slot opens.
"""
import asyncio
import time
from loguru import logger


class KieRateLimiter:
    """Async rate limiter: max N requests per window, excess waits in queue."""

    def __init__(self, max_requests: int = 20, window_seconds: float = 10.0):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._timestamps: list[float] = []
        self._lock = asyncio.Lock()
        self._queue_size = 0

    @property
    def queued(self) -> int:
        return self._queue_size

    async def acquire(self) -> None:
        """Wait until a rate-limit slot is available, then reserve it."""
        self._queue_size += 1
        try:
            while True:
                async with self._lock:
                    now = time.monotonic()
                    # Remove timestamps outside the window
                    self._timestamps = [
                        t for t in self._timestamps
                        if now - t < self.window_seconds
                    ]

                    if len(self._timestamps) < self.max_requests:
                        self._timestamps.append(now)
                        return

                    # How long until the oldest request exits the window?
                    wait_time = self._timestamps[0] + self.window_seconds - now

                logger.info(
                    f"[RateLimiter] Limit reached ({self.max_requests}/{self.window_seconds}s), "
                    f"waiting {wait_time:.1f}s, queued={self._queue_size}"
                )
                await asyncio.sleep(wait_time + 0.1)
        finally:
            self._queue_size -= 1


# ── Singleton ──
_rate_limiter = None


def get_rate_limiter() -> KieRateLimiter:
    global _rate_limiter
    if _rate_limiter is None:
        _rate_limiter = KieRateLimiter(max_requests=20, window_seconds=10.0)
    return _rate_limiter
