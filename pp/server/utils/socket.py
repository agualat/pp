from fastapi import WebSocket
from typing import Dict
# Diccionario para almacenar métricas por cliente
clients_metrics: Dict[str, dict] = {}

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}

    async def connect(self, client_id: str, websocket: WebSocket):
        await websocket.accept()
        self.active_connections[client_id] = websocket

    def disconnect(self, client_id: str):
        self.active_connections.pop(client_id, None)
        clients_metrics.pop(client_id, None)

    async def broadcast(self, message: dict):
        for ws in self.active_connections.values():
            await ws.send_json(message)