from fastapi import FastAPI
from .router.ws import router as ws_router
from .router.auth import router as auth_router
from .router.ansible import router as ansible_router
from .router.executions import router as executions_router
from .router.servers import router as servers_router

app = FastAPI()

@app.get("/")
def read_root():
    return {"hello": "server"}

app.include_router(ws_router)
app.include_router(auth_router)
app.include_router(ansible_router)
app.include_router(executions_router)
app.include_router(servers_router)