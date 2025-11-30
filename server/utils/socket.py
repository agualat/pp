from fastapi import WebSocket
from typing import Dict

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}

    async def connect(self, server_id: str, websocket: WebSocket):
        await websocket.accept()
        self.active_connections[server_id] = websocket

    def disconnect(self, server_id: str):
        self.active_connections.pop(server_id, None)

    async def broadcast(self, message: dict):
        for ws in self.active_connections.values():
            await ws.send_json(message)