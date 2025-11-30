from fastapi import APIRouter, Query
from typing import Any
from ..utils.metrics import get_system_info, build_server_metric
from ..models.metrics import MetricOut, LocalSystemMetrics

router = APIRouter(prefix="/metrics", tags=["metrics"])

@router.get("/local", response_model=LocalSystemMetrics)
async def local_metrics():
    """Return raw detailed local system metrics snapshot."""
    return LocalSystemMetrics(data=get_system_info(), collected_at="now")

@router.get("/server-format", response_model=MetricOut)
async def server_format_metric(server_id: int = Query(1, ge=1)):
    """Return a compact metric formatted for server ingestion/storage."""
    metric = build_server_metric(server_id)
    if isinstance(metric, MetricOut):
        return metric
    return MetricOut(**metric)  # type: ignore