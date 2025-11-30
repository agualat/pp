import os
import asyncio
import json
import logging
import socket
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
        self.server_id: Optional[int] = None  # Se obtendrá del registro (opcional ahora)
        self.interval = float(os.getenv("METRIC_INTERVAL", "1"))  # Reducir a 1 segundo por defecto
        self._task: Optional[asyncio.Task] = None
        self._stop_event = asyncio.Event()
        self._registered = False
        
        # Cachear hostname e IP para no calcularlos cada vez
        self._hostname = self._get_hostname()
        self._ip_address = self._get_local_ip()

    def _get_hostname(self) -> str:
        """Obtiene el hostname del cliente"""
        try:
            return socket.gethostname()
        except:
            return f"client-unknown"

    def _get_local_ip(self) -> str:
        """Obtiene la IP local del cliente"""
        try:
            # Conectar a un servidor externo para obtener la IP local
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            ip = s.getsockname()[0]
            s.close()
            return ip
        except:
            return "127.0.0.1"

    async def _register_server(self):
        """Registra el servidor/cliente en la API central y obtiene el ID (opcional)"""
        if self._registered and self.server_id is not None:
            return
        
        try:
            import httpx
            
            client_url = f"http://{self.server_host}:{self.server_port}"
            
            # Intentar registrar el servidor en la API
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.post(
                    f"{client_url}/api/server-config/register",
                    json={
                        "name": self._hostname,
                        "ip_address": self._ip_address,
                        "ssh_port": 22,
                        "ssh_user": "root",
                        "ssh_password": "",
                        "description": f"Auto-registered client {self._hostname}"
                    }
                )
                
                if response.status_code == 200:
                    result = response.json()
                    self.server_id = result.get('id')
                    logger.info(f"✓ Server registered successfully: {self._hostname} ({self._ip_address}) - ID: {self.server_id}")
                    self._registered = True
                    return True
                else:
                    logger.warning(f"Failed to register server: HTTP {response.status_code} - {response.text}")
                    return False
        except Exception as e:
            logger.error(f"Error registering server: {e}")
            return False
    
    @property
    def ws_url(self) -> str:
        """Retorna la URL del WebSocket - ahora usando el endpoint sin ID"""
        if self.server_ws_url_override:
            return self.server_ws_url_override
        # Usar el nuevo endpoint que no requiere ID
        return f"ws://{self.server_host}:{self.server_port}/ws/metrics"

    async def _send_loop(self):
        backoff = RECONNECT_BASE
        consecutive_failures = 0
        max_quiet_failures = 5  # Después de 5 fallos, solo log cada 10 intentos
        
        while not self._stop_event.is_set():
            if websockets is None:
                logger.error("websockets library not installed. Install with: pip install websockets")
                await asyncio.sleep(10)
                continue
            try:
                # Intentar registrar el servidor antes de conectar (opcional, para obtener ID)
                if not self._registered:
                    logger.info("Attempting to register server with central API...")
                    await self._register_server()
                    # Continuar incluso si falla el registro, el WebSocket funcionará con IP/hostname
                
                logger.info(f"Connecting to {self.ws_url}")
                
                async with websockets.connect(self.ws_url, ping_interval=None) as ws:  # type: ignore
                    logger.info(f"Connected. Sending metrics as {self._hostname} ({self._ip_address})")
                    backoff = RECONNECT_BASE  # reset after success
                    consecutive_failures = 0  # reset failure counter
                    
                    while not self._stop_event.is_set():
                        # Construir métrica (puede usar server_id si está disponible, pero no es requerido)
                        metric = build_server_metric(self.server_id)
                        
                        # Ensure payload is a plain dict for JSON serialization
                        if hasattr(metric, "model_dump"):
                            payload = getattr(metric, "model_dump")()  # pydantic v2
                        elif hasattr(metric, "dict"):
                            payload = getattr(metric, "dict")()  # pydantic v1
                        else:
                            payload = metric  # assume already a dict
                        
                        # Agregar identificación (IP y hostname) a cada mensaje
                        payload["ip_address"] = self._ip_address
                        payload["hostname"] = self._hostname
                        
                        await ws.send(json.dumps(payload))
                        await asyncio.sleep(self.interval)
                        
            except Exception as e:
                consecutive_failures += 1
                
                # Solo hacer log si es uno de los primeros fallos o cada 10 intentos
                if consecutive_failures <= max_quiet_failures or consecutive_failures % 10 == 0:
                    logger.warning(f"Metrics sender connection error: {e}. Reconnecting in {backoff}s (attempt {consecutive_failures})")
                
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
