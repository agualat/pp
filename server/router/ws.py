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
    WebSocket para que el frontend reciba métricas en tiempo real de un servidor.
    El servidor API se conecta al cliente para obtener las métricas en vivo.
    """
    from ..utils.db import SessionLocal
    from ..CRUD.servers import get_server_by_id
    
    print(f"[WS] Frontend connecting to metrics stream for server {server_id}")
    await websocket.accept()
    print(f"[WS] Frontend connected to server {server_id}")
    
    db = SessionLocal()
    
    try:
        # Obtener información del servidor
        server = get_server_by_id(db, server_id)
        if not server:
            await websocket.send_json({
                "error": "Server not found",
                "cpu_usage": "N/A",
                "memory_usage": "N/A",
                "disk_usage": "N/A",
                "gpu_usage": "N/A",
                "timestamp": datetime.utcnow().isoformat()
            })
            return

        client_ws_url = f"ws://{server.ip_address}:8100/ws/status"
        print(f"[WS] Using external IP: {client_ws_url}")
        
        print(f"[WS] Attempting to connect to client at {client_ws_url}")
        
        client_connected = False
        try:
            import websockets
            # Timeouts más generosos y ping más frecuente para mantener conexión
            async with websockets.connect(
                client_ws_url, 
                ping_interval=10,
                ping_timeout=30,
                close_timeout=5,
                open_timeout=30,
                max_size=10_000_000
            ) as client_ws:
                print(f"[WS] Connected to client {server.name} ({server.ip_address})")
                client_connected = True
                
                # Marcar servidor como online
                set_server_online(db, server_id)
                
                # Relay de métricas del cliente al frontend
                while True:
                    try:
                        # Recibir métricas del cliente con timeout generoso
                        client_data = await asyncio.wait_for(client_ws.recv(), timeout=15.0)
                        raw_data = json.loads(client_data)
                        
                        # Transformar formato del cliente al formato esperado por el frontend
                        data = {
                            "cpu": raw_data.get("cpu"),
                            "cpu_usage": raw_data.get("cpu"),  # Para compatibilidad
                            "ram": raw_data.get("ram"),
                            "memory_usage": raw_data.get("ram"),  # Para compatibilidad
                            "disk": raw_data.get("disk"),
                            "disk_usage": raw_data.get("disk"),  # Para compatibilidad
                            "gpu": raw_data.get("gpu"),
                            "gpu_usage": raw_data.get("gpu"),  # Para compatibilidad
                            "timestamp": raw_data.get("timestamp", datetime.utcnow().isoformat())
                        }
                        
                        # Enviar al frontend
                        await websocket.send_json(data)
                        
                        # Guardar en BD para histórico
                        def ensure_string(value, default="N/A"):
                            if value is None:
                                return default
                            if isinstance(value, str):
                                return value
                            try:
                                return json.dumps(value)
                            except Exception:
                                return str(value)
                        
                        metric = Metric(
                            server_id=server_id,
                            cpu_usage=ensure_string(raw_data.get("cpu"), "0"),
                            memory_usage=ensure_string(raw_data.get("ram"), "0"),
                            disk_usage=ensure_string(raw_data.get("disk"), "0"),
                            gpu_usage=ensure_string(raw_data.get("gpu"), "N/A"),
                            timestamp=raw_data.get("timestamp") or datetime.utcnow().isoformat(),
                        )
                        db.add(metric)
                        db.commit()
                        
                    except asyncio.TimeoutError:
                        # Enviar ping al frontend para mantener viva la conexión
                        try:
                            await websocket.send_json({"type": "ping", "timestamp": datetime.utcnow().isoformat()})
                        except:
                            break
                        continue
                    except Exception as e:
                        print(f"[WS] Error receiving from client: {e}")
                        break
                        
        except Exception as e:
            print(f"[WS] Failed to connect to client {server.name}: {e}")
            print(f"[WS] Using database fallback for server {server_id}")
            # Fallback a métricas de la BD con actualización más rápida
            try:
                while True:
                    metric = db.query(Metric)\
                        .filter(Metric.server_id == server_id)\
                        .order_by(Metric.id.desc())\
                        .first()
                    
                    if metric:
                        data = {
                            "cpu_usage": metric.cpu_usage,
                            "memory_usage": metric.memory_usage,
                            "disk_usage": metric.disk_usage,
                            "gpu_usage": metric.gpu_usage,
                            "timestamp": metric.timestamp
                        }
                        print(f"[WS DEBUG] Sending to frontend for server {server_id}: cpu={metric.cpu_usage[:50]}, mem={metric.memory_usage[:50]}")
                        await websocket.send_json(data)
                    else:
                        print(f"[WS] No metrics found for server {server_id}")
                        await websocket.send_json({
                            "cpu_usage": "N/A",
                            "memory_usage": "N/A",
                            "disk_usage": "N/A",
                            "gpu_usage": "N/A",
                            "timestamp": datetime.utcnow().isoformat(),
                            "error": "No metrics available"
                        })
                    
                    await asyncio.sleep(2.0)
            except WebSocketDisconnect:
                print(f"[WS] Frontend disconnected during fallback for server {server_id}")
            
    except WebSocketDisconnect:
        print(f"[WS] Frontend disconnected from metrics stream for server {server_id}")
    except Exception as e:
        print(f"[WS] Error in metrics WebSocket for server {server_id}: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()
        try:
            await websocket.close()
        except:
            pass


# WebSocket endpoint para servidores que envían métricas (identificación automática)
@router.websocket("/ws/metrics")
async def server_metrics_ws(websocket: WebSocket):
    """
    WebSocket para que los clientes envíen métricas con su IP/hostname
    El servidor resuelve automáticamente el ID basado en IP o hostname
    """
    from ..utils.db import SessionLocal
    from ..CRUD.servers import get_server_by_ip
    from ..models.models import Server as ServerModel
    
    print(f"[WS] Client attempting to connect for sending metrics")
    await websocket.accept()
    print(f"[WS] Client connected, waiting for identification")
    
    db = SessionLocal()
    server_id = None
    
    try:
        while True:
            # Recibir mensaje del cliente
            msg = await websocket.receive_text()
            try:
                data = json.loads(msg)
            except Exception:
                print(f"[WS] Error parsing message: {msg}")
                continue
            
            # Obtener IP o hostname del mensaje
            client_ip = data.get("ip_address")
            client_hostname = data.get("hostname")
            
            if not client_ip and not client_hostname:
                print(f"[WS] No IP or hostname provided in metrics")
                continue
            
            # Buscar servidor por IP o crear uno nuevo
            if client_ip:
                server = get_server_by_ip(db, client_ip)
                if not server and client_hostname:
                    # Buscar por nombre si no se encuentra por IP
                    server = db.query(ServerModel).filter(ServerModel.name == client_hostname).first()
                
                if not server:
                    # Auto-crear servidor con los datos proporcionados
                    print(f"[WS] Auto-creating server: {client_hostname} ({client_ip})")
                    server = ServerModel(
                        name=client_hostname or f"server-{client_ip}",
                        ip_address=client_ip,
                        status="online",
                        ssh_user="root"
                    )
                    db.add(server)
                    db.commit()
                    db.refresh(server)
                    print(f"[WS] Server created with ID: {server.id}")
                
                server_id = server.id
                
                # Actualizar estado si cambió
                if server.status != "online":
                    set_server_online(db, server_id)
            
            # Normalizar campos de métricas
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

            # Guardar métrica
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
            
            if server_id:
                print(f"[WS] Metric saved for server {server_id} ({client_hostname})")
            
    except WebSocketDisconnect:
        print(f"[WS] Client disconnected")
        if server_id:
            set_server_offline(db, server_id)
    except Exception as e:
        print(f"[WS] Error in metrics WebSocket: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()
        try:
            await websocket.close()
        except:
            pass
