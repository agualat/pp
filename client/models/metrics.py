from pydantic import BaseModel
from typing import Any
from datetime import datetime
import json

class MetricOut(BaseModel):
    server_id: int
    cpu_usage: str
    memory_usage: str
    disk_usage: str
    timestamp: str
    gpu_usage: str = "N/A"

    @staticmethod
    def from_system_info(server_id: int, system_info: dict) -> "MetricOut":
        cpu = system_info.get("cpu", {})
        ram = system_info.get("ram", {})
        disk = system_info.get("disk", {})
        # Compact representations as JSON strings to match server string columns
        cpu_str = json.dumps({
            "usage_percent": cpu.get("usage_percent"),
            "cores_logical": cpu.get("cores_logical"),
            "cores_physical": cpu.get("cores_physical")
        })
        memory_str = json.dumps({
            "total": ram.get("total"),
            "available": ram.get("available"),
            "used": ram.get("used"),
            "percent": ram.get("percent")
        })
        disk_usage = disk.get("usage") or {}
        disk_str = json.dumps({
            "total": disk_usage.get("total"),
            "used": disk_usage.get("used"),
            "free": disk_usage.get("free"),
            "percent": disk_usage.get("percent")
        })
        return MetricOut(
            server_id=server_id,
            cpu_usage=cpu_str,
            memory_usage=memory_str,
            disk_usage=disk_str,
            timestamp=datetime.utcnow().isoformat() + "Z",
            gpu_usage="N/A"
        )

class LocalSystemMetrics(BaseModel):
    data: Any
    collected_at: str
