import psutil
import subprocess
import json
from datetime import datetime
from . import __name__ as package_name  # placeholder if needed
try:
    from ..models.metrics import MetricOut
except Exception:
    MetricOut = None  # Avoid hard failure if import path changes

def get_system_info():
    info = {}

    # CPU
    info["cpu"] = {
        "usage_percent": psutil.cpu_percent(interval=1),
        "usage_per_core": psutil.cpu_percent(interval=1, percpu=True),
        "cores_logical": psutil.cpu_count(logical=True),
        "cores_physical": psutil.cpu_count(logical=False),
        "frequency": psutil.cpu_freq()._asdict() if psutil.cpu_freq() else None,
        "load_avg": psutil.getloadavg() if hasattr(psutil, "getloadavg") else None
    }

    # RAM
    ram = psutil.virtual_memory()
    info["ram"] = ram._asdict()

    # SWAP
    swap = psutil.swap_memory()
    info["swap"] = swap._asdict()

    # Disco
    disk_partitions = [p._asdict() for p in psutil.disk_partitions()]
    disk_usage = psutil.disk_usage("/") if hasattr(psutil, "disk_usage") else None
    disk_io = psutil.disk_io_counters() if hasattr(psutil, "disk_io_counters") else None

    info["disk"] = {
        "partitions": disk_partitions,
        "usage": disk_usage._asdict() if disk_usage else None,
        "io": disk_io._asdict() if disk_io else None
    }

    # Red
    info["network"] = {
        "io": psutil.net_io_counters()._asdict(),
        "connections": [c._asdict() for c in psutil.net_connections()]
    }

    # Sensores (si existen)
    sensors_temperatures = getattr(psutil, "sensors_temperatures", None)
    sensors_fans = getattr(psutil, "sensors_fans", None)
    sensors_battery = getattr(psutil, "sensors_battery", None)
    try:
        temps = sensors_temperatures() if callable(sensors_temperatures) else None
        fans = sensors_fans() if callable(sensors_fans) else None
        battery = sensors_battery() if callable(sensors_battery) else None
    except Exception:
        temps = fans = battery = None

    info["sensors"] = {
        "temperatures": {k: [t._asdict() for t in v] for k, v in temps.items()} if isinstance(temps, dict) else None,
        "fans": {k: [f._asdict() for f in v] for k, v in fans.items()} if isinstance(fans, dict) else None,
        "battery": getattr(battery, "_asdict")() if battery and callable(getattr(battery, "_asdict", None)) else None
    }

    # GPU metrics (NVIDIA / generic) - attempt GPUtil first, then nvidia-smi
    gpu_list = []
    summary = "N/A"
    try:
        import GPUtil  # type: ignore
        gpus = GPUtil.getGPUs()
        for g in gpus:
            gpu_entry = {
                "id": g.id,
                "name": g.name,
                "load": round(g.load * 100, 2),  # percent
                "memory_used_mb": round(g.memoryUsed, 2),
                "memory_total_mb": round(g.memoryTotal, 2),
                "memory_utilization": round((g.memoryUsed / g.memoryTotal * 100) if g.memoryTotal else 0, 2),
                "temperature": g.temperature,
                "uuid": getattr(g, "uuid", None),
            }
            gpu_list.append(gpu_entry)
        if gpu_list:
            # Simple summary: first GPU load and memory utilization
            first = gpu_list[0]
            summary = json.dumps({
                "gpu_id": first["id"],
                "load_percent": first["load"],
                "mem_percent": first["memory_utilization"],
                "temp_c": first["temperature"],
            })
    except Exception:
        # Fallback to nvidia-smi parsing
        try:
            cmd = [
                "nvidia-smi",
                "--query-gpu=index,name,utilization.gpu,utilization.memory,memory.total,memory.used,temperature.gpu",
                "--format=csv,noheader,nounits"
            ]
            result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=2)
            if result.returncode == 0:
                lines = [l.strip() for l in result.stdout.splitlines() if l.strip()]
                for line in lines:
                    parts = [p.strip() for p in line.split(',')]
                    if len(parts) == 7:
                        idx, name, util_gpu, util_mem, mem_total, mem_used, temp = parts
                        mem_total_f = float(mem_total)
                        mem_used_f = float(mem_used)
                        mem_util = round((mem_used_f / mem_total_f * 100) if mem_total_f else 0, 2)
                        gpu_entry = {
                            "id": int(idx),
                            "name": name,
                            "load": float(util_gpu),
                            "memory_used_mb": mem_used_f,
                            "memory_total_mb": mem_total_f,
                            "memory_utilization": mem_util,
                            "temperature": float(temp),
                        }
                        gpu_list.append(gpu_entry)
                if gpu_list:
                    first = gpu_list[0]
                    summary = json.dumps({
                        "gpu_id": first["id"],
                        "load_percent": first["load"],
                        "mem_percent": first["memory_utilization"],
                        "temp_c": first["temperature"],
                    })
        except Exception:
            pass

    info["gpu"] = {
        "devices": gpu_list if gpu_list else None,
        "summary": summary
    }

    return info

def build_server_metric(server_id: int):
    """Return a MetricOut instance (or dict fallback) compatible with server schema."""
    sys_info = get_system_info()
    if MetricOut is not None:
        return MetricOut.from_system_info(server_id=server_id, system_info=sys_info)
    # Fallback dict if model unavailable
    from json import dumps
    cpu = sys_info.get("cpu", {})
    ram = sys_info.get("ram", {})
    disk = sys_info.get("disk", {}).get("usage", {})
    gpu_summary = sys_info.get("gpu", {}).get("summary", "N/A")
    return {
        "server_id": server_id,
        "cpu_usage": dumps({"usage_percent": cpu.get("usage_percent")}),
        "memory_usage": dumps({"used": ram.get("used"), "percent": ram.get("percent")}),
        "disk_usage": dumps({"percent": disk.get("percent")}),
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "gpu_usage": gpu_summary
    }

if __name__ == "__main__":
    import pprint
    pprint.pprint(get_system_info())