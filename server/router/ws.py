from fastapi import WebSocket, WebSocketDisconnect, APIRouter, Depends
from sqlalchemy.orm import Session
from ..utils.socket import ConnectionManager
from ..utils.db import get_db
from ..models.models import Metric
from ..CRUD.servers import get_server_by_id, set_server_online, set_server_offline
from datetime import datetime
import json

manager = ConnectionManager()

router = APIRouter()

# WebSocket endpoint para servidores que envían métricas
@router.websocket("/ws/server/{server_id}")
async def server_metrics_ws(websocket: WebSocket, server_id: int, db: Session = Depends(get_db)):
    from ..models.models import Server as ServerModel
    
    # Obtener o crear el servidor automáticamente
    server = get_server_by_id(db, server_id)
    if not server:
        # Auto-crear servidor con datos por defecto
        server = ServerModel(
            id=server_id,
            name=f"auto-server-{server_id}",
            ip_address=f"0.0.0.{server_id}",
            status="online",
            ssh_user="root"
        )
        db.add(server)
        db.commit()
        db.refresh(server)
    
    await manager.connect(str(server_id), websocket)
    set_server_online(db, server_id)
    
    try:
        while True:
            # Be tolerant: accept text or JSON frames
            msg = await websocket.receive_text()
            try:
                data = json.loads(msg)
            except Exception:
                # If it's already a dict (receive_json used by client), fallback
                try:
                    data = await websocket.receive_json()
                except Exception:
                    # Unable to parse; skip
                    continue

            # Normalize fields: accept both dicts and JSON strings
            def ensure_string(value, default="N/A"):
                if value is None:
                    return default
                if isinstance(value, str):
                    return value
                try:
                    return json.dumps(value)
                except Exception:
                    return str(value)

            cpu_val = ensure_string(data.get("cpu_usage"), "0")
            mem_val = ensure_string(data.get("memory_usage"), "0")
            disk_val = ensure_string(data.get("disk_usage"), "0")
            gpu_val = ensure_string(data.get("gpu_usage"), "N/A")
            ts_val = data.get("timestamp") or datetime.utcnow().isoformat()

            metric = Metric(
                server_id=server_id,
                cpu_usage=cpu_val,
                memory_usage=mem_val,
                disk_usage=disk_val,
                gpu_usage=gpu_val,
                timestamp=ts_val,
            )
            db.add(metric)
            db.commit()
    except WebSocketDisconnect:
        manager.disconnect(str(server_id))
        set_server_offline(db, server_id)