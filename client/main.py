from fastapi import FastAPI
from client.router.metrics import router as metrics_router
from client.router.sync import router as sync_router

app = FastAPI()

@app.get("/")
def read_root():
    return {"hello": "client"}

app.include_router(metrics_router)
app.include_router(sync_router)