import asyncio
import websockets
import httpx
import json

WS_URL = "ws://ip_del_cliente:puerto/ws/status"  # WebSocket del cliente
API_URL = "http://mi-api.com/metrics"            # API donde mandar las métricas


async def listen_and_forward():
    async with websockets.connect(WS_URL) as websocket:
        print("Conectado al WebSocket del cliente.")

        async with httpx.AsyncClient() as client:
            while True:
                try:
                    # 1. Recibir métricas del cliente
                    data = await websocket.recv()
                    metrics = json.loads(data)

                    print("Recibido:", metrics)

                    # 2. Enviar métricas a la API
                    response = await client.post(API_URL, json=metrics)
                    
                    print("Enviado a API:", response.status_code)

                except websockets.ConnectionClosed:
                    print("Conexión perdida, reconectando...")
                    await asyncio.sleep(3)
                    return await listen_and_forward()

                except Exception as e:
                    print("Error:", e)
                    await asyncio.sleep(1)


asyncio.run(listen_and_forward())
