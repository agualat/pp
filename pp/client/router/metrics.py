from fastapi import APIRouter
import asyncio
from 

router = APIRouter(
    prefix="/metrics",
    tags=["metrics", "users"]
)

@router.get("/")
async def get_ws():
    pass