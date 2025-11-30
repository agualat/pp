from fastapi import FastAPI, WebSocket
import asyncio
from contextlib import asynccontextmanager
from client.utils.metrics import get_system_info
from client.utils.metrics_sender import start_sender, stop_sender
from client.router.metrics import router as metrics_router
from client.router.server_config import router as server_config_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup phase
    start_sender()
    try:
        yield
    finally:
        # Shutdown phase
        await stop_sender()

app = FastAPI(lifespan=lifespan)

@app.get("/")
def read_root():
    return {"hello": "client"}

@app.websocket("/ws/status")
async def websocket_status(ws: WebSocket):
    await ws.accept()
    try:
        while True:
            data = get_system_info()
            await ws.send_json(data)
            await asyncio.sleep(0.5)  # enviar cada 0.5s para actualizaciones más rápidas
    except Exception:
        pass

app.include_router(metrics_router)
app.include_router(server_config_router)