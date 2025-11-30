from fastapi import FastAPI, WebSocket
import asyncio
from client.utils.metrics import get_system_info


app = FastAPI()

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
            await asyncio.sleep(1)  # enviar cada 1s en "tiempo real"
    except Exception:
        pass