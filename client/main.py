from fastapi import FastAPI
from contextlib import asynccontextmanager
from client.utils.metrics_sender import start_sender, stop_sender
from client.router.metrics import router as metrics_router
from client.router.server_config import router as server_config_router
from client.router.sync import router as sync_router


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

app.include_router(metrics_router)
app.include_router(server_config_router)
app.include_router(sync_router)