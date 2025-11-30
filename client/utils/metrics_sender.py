import os
import asyncio
import json
import logging
from typing import Optional

try:
    import websockets  # type: ignore
except ImportError:  # Fallback simple stub to avoid hard crash if library missing
    websockets = None  # type: ignore

from .metrics import build_server_metric

logger = logging.getLogger("metrics_sender")
logger.setLevel(logging.INFO)

RECONNECT_BASE = 2
RECONNECT_MAX = 30

class MetricsSender:
    def __init__(self):
        # Allow a full URL override for convenience
        self.server_ws_url_override = os.getenv("SERVER_WS_URL")
        self.server_host = os.getenv("SERVER_HOST", "localhost")
        self.server_port = os.getenv("SERVER_PORT", "8000")
        self.server_id = int(os.getenv("SERVER_ID", "1"))
        self.interval = float(os.getenv("METRIC_INTERVAL", "5"))
        self._task: Optional[asyncio.Task] = None
        self._stop_event = asyncio.Event()

    @property
    def ws_url(self) -> str:
        if self.server_ws_url_override:
            return self.server_ws_url_override
        return f"ws://{self.server_host}:{self.server_port}/ws/server/{self.server_id}"

    async def _send_loop(self):
        backoff = RECONNECT_BASE
        while not self._stop_event.is_set():
            if websockets is None:
                logger.error("websockets library not installed. Install with: pip install websockets")
                await asyncio.sleep(30)
                continue
            try:
                logger.info(f"Connecting to {self.ws_url}")
                async with websockets.connect(self.ws_url, ping_interval=None) as ws:  # type: ignore
                    logger.info("Connected. Sending metrics...")
                    backoff = RECONNECT_BASE  # reset after success
                    while not self._stop_event.is_set():
                        metric = build_server_metric(self.server_id)
                        # Ensure payload is a plain dict for JSON serialization
                        if hasattr(metric, "model_dump"):
                            payload = metric.model_dump()  # pydantic v2
                        elif hasattr(metric, "dict"):
                            payload = metric.dict()  # pydantic v1
                        else:
                            payload = metric  # assume already a dict
                        await ws.send(json.dumps(payload))
                        await asyncio.sleep(self.interval)
            except Exception as e:
                logger.warning(f"Metrics sender connection error: {e}. Reconnecting in {backoff}s")
                await asyncio.sleep(backoff)
                backoff = min(backoff * 2, RECONNECT_MAX)

    def start(self):
        if self._task is None or self._task.done():
            self._task = asyncio.create_task(self._send_loop())

    async def stop(self):
        self._stop_event.set()
        if self._task:
            await self._task

_sender: Optional[MetricsSender] = None

def start_sender():
    global _sender
    if _sender is None:
        _sender = MetricsSender()
        _sender.start()

async def stop_sender():
    global _sender
    if _sender is not None:
        await _sender.stop()
        _sender = None
