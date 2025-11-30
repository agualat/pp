from fastapi import WebSocket, WebSocketDisconnect, APIRouter
from ..utils.socket import ConnectionManager
from typing import Dict

manager = ConnectionManager()
clients_metrics: Dict[str, dict] = {}

router = APIRouter()

# WS endpoint para clientes que envían métricas
@router.websocket("/ws/client/{client_id}")
async def client_ws(websocket: WebSocket, client_id: str):
    await manager.connect(client_id, websocket)
    try:
        while True:
            data = await websocket.receive_json()
            clients_metrics[client_id] = data
            # Opcional: reenviar a todos los demás
            # await manager.broadcast({client_id: data})
    except WebSocketDisconnect:
        manager.disconnect(client_id)

# Endpoint REST para obtener métricas de todos los clientes
@router.get("/metrics")
async def get_metrics():
    return clients_metrics