from fastapi import WebSocket, WebSocketDisconnect, APIRouter, Depends
from sqlalchemy.orm import Session
from ..utils.socket import ConnectionManager
from ..utils.db import get_db
from ..models.models import Metric
from ..CRUD.servers import get_server_by_id, set_server_online, set_server_offline
from datetime import datetime
import json
import asyncio

manager = ConnectionManager()

router = APIRouter()

# WebSocket endpoint para frontend - enviar métricas en tiempo real
@router.websocket("/ws/metrics/{server_id}")
async def client_metrics_ws(websocket: WebSocket, server_id: int):
    """
    WebSocket para que el frontend reciba métricas en tiempo real de un servidor
    """
    from ..utils.db import SessionLocal
    
    print(f"[WS] Frontend connecting to metrics stream for server {server_id}")
    await websocket.accept()
    print(f"[WS] Frontend connected to server {server_id}")
    
    try:
        while True:
            # Crear nueva sesión en cada iteración para obtener datos frescos
            db = SessionLocal()
            try:
                # Obtener la última métrica del servidor
                metric = db.query(Metric)\
                    .filter(Metric.server_id == server_id)\
                    .order_by(Metric.id.desc())\
                    .first()
                
                if metric:
                    print(f"[WS] Sending metric to frontend for server {server_id}: CPU={metric.cpu_usage}")
                    # Enviar métrica al frontend
                    await websocket.send_json({
                        "cpu_usage": metric.cpu_usage,
                        "memory_usage": metric.memory_usage,
                        "disk_usage": metric.disk_usage,
                        "gpu_usage": metric.gpu_usage,
                        "timestamp": metric.timestamp
                    })
                else:
                    print(f"[WS] No metrics found for server {server_id}, sending N/A")
                    # Enviar mensaje de que no hay métricas
                    await websocket.send_json({
                        "cpu_usage": "N/A",
                        "memory_usage": "N/A",
                        "disk_usage": "N/A",
                        "gpu_usage": "N/A",
                        "timestamp": datetime.utcnow().isoformat()
                    })
            finally:
                db.close()
            
            # Esperar 0.5 segundos antes de enviar la siguiente métrica
            await asyncio.sleep(0.5)
            
    except WebSocketDisconnect:
        print(f"[WS] Frontend disconnected from metrics stream for server {server_id}")
    except Exception as e:
        print(f"[WS] Error in metrics WebSocket for server {server_id}: {e}")
        import traceback
        traceback.print_exc()
    finally:
        try:
            await websocket.close()
        except:
            pass


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