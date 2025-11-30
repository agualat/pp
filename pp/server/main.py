from fastapi import FastAPI
from .router.ws import router as ws_router

app = FastAPI()

@app.get("/")
def read_root():
    return {"hello": "server"}

app.include_router(ws_router)