import psutil

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

    return info

if __name__ == "__main__":
    import pprint
    pprint.pprint(get_system_info())