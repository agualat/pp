"""Validators for Docker container configurations."""

import re
from typing import List, Optional, Tuple


class DockerValidationError(Exception):
    """Raised when Docker configuration validation fails."""

    pass


def validate_container_name(name: str) -> bool:
    """
    Validate Docker container name.

    Rules:
    - Only alphanumeric, hyphens, and underscores
    - Must start with alphanumeric
    - 1-128 characters

    Args:
        name: Container name

    Returns:
        True if valid

    Raises:
        DockerValidationError: If name is invalid
    """
    if not name:
        raise DockerValidationError("Container name cannot be empty")

    if len(name) > 128:
        raise DockerValidationError("Container name too long (max 128 characters)")

    if not re.match(r"^[a-zA-Z0-9][a-zA-Z0-9_.-]*$", name):
        raise DockerValidationError(
            "Container name must start with alphanumeric and contain only alphanumeric, hyphens, underscores, and dots"
        )

    return True


def validate_image_name(image: str) -> bool:
    """
    Validate Docker image name.

    Examples:
    - nginx
    - nginx:latest
    - nginx:1.21
    - myregistry.com:5000/nginx:latest

    Args:
        image: Docker image name

    Returns:
        True if valid

    Raises:
        DockerValidationError: If image name is invalid
    """
    if not image:
        raise DockerValidationError("Image name cannot be empty")

    # Basic validation: allow registry/image:tag format
    pattern = (
        r"^(?:[a-zA-Z0-9._-]+(?::[0-9]+)?/)?[a-zA-Z0-9._/-]+(?::[a-zA-Z0-9._-]+)?$"
    )

    if not re.match(pattern, image):
        raise DockerValidationError(
            "Invalid image name format. Use: [registry/]image[:tag]"
        )

    return True


def validate_port_mapping(port_mapping: str) -> Tuple[int, int]:
    """
    Validate a single port mapping.

    Format: "host_port:container_port"
    Example: "8080:80"

    Args:
        port_mapping: Port mapping string

    Returns:
        Tuple of (host_port, container_port)

    Raises:
        DockerValidationError: If port mapping is invalid
    """
    if not port_mapping or ":" not in port_mapping:
        raise DockerValidationError(
            f"Invalid port mapping format: {port_mapping}. Use: host_port:container_port"
        )

    parts = port_mapping.split(":")
    if len(parts) != 2:
        raise DockerValidationError(
            f"Invalid port mapping: {port_mapping}. Use: host_port:container_port"
        )

    try:
        host_port = int(parts[0].strip())
        container_port = int(parts[1].strip())
    except ValueError:
        raise DockerValidationError(f"Ports must be integers: {port_mapping}")

    # Validate port ranges
    if not (1 <= host_port <= 65535):
        raise DockerValidationError(
            f"Host port must be between 1 and 65535: {host_port}"
        )

    if not (1 <= container_port <= 65535):
        raise DockerValidationError(
            f"Container port must be between 1 and 65535: {container_port}"
        )

    # Warn about privileged ports (1-3999)
    if host_port < 4000:
        raise DockerValidationError(
            f"Cannot use port below 4000 on host: {host_port}. Use ports >= 4000"
        )

    return host_port, container_port


def validate_ports(ports: Optional[str]) -> List[Tuple[int, int]]:
    """
    Validate port mappings string.

    Format: "host:container" or "host1:container1,host2:container2"
    Examples:
    - "8080:80"
    - "8080:80,9000:9000"
    - "3000:3000,5432:5432,6379:6379"

    Args:
        ports: Port mappings string (comma-separated)

    Returns:
        List of validated port tuples

    Raises:
        DockerValidationError: If any port mapping is invalid
    """
    if not ports:
        return []

    validated_ports = []
    seen_host_ports = set()

    for mapping in ports.split(","):
        mapping = mapping.strip()
        if not mapping:
            continue

        host_port, container_port = validate_port_mapping(mapping)

        # Check for duplicate host ports
        if host_port in seen_host_ports:
            raise DockerValidationError(f"Duplicate host port: {host_port}")

        seen_host_ports.add(host_port)
        validated_ports.append((host_port, container_port))

    return validated_ports


def validate_volume_mapping(volume: str) -> Tuple[str, str]:
    """
    Validate a single volume mapping.

    Format: "host_path:container_path" or "host_path:container_path:mode"
    Examples:
    - "/data:/app/data"
    - "/data:/app/data:ro"

    Args:
        volume: Volume mapping string

    Returns:
        Tuple of (host_path, container_path)

    Raises:
        DockerValidationError: If volume mapping is invalid
    """
    if not volume or ":" not in volume:
        raise DockerValidationError(
            f"Invalid volume format: {volume}. Use: host_path:container_path[:mode]"
        )

    parts = volume.split(":")
    if len(parts) < 2 or len(parts) > 3:
        raise DockerValidationError(
            f"Invalid volume format: {volume}. Use: host_path:container_path[:mode]"
        )

    host_path = parts[0].strip()
    container_path = parts[1].strip()
    mode = parts[2].strip() if len(parts) == 3 else "rw"

    # Validate paths are absolute
    if not host_path.startswith("/"):
        raise DockerValidationError(f"Host path must be absolute: {host_path}")

    if not container_path.startswith("/"):
        raise DockerValidationError(
            f"Container path must be absolute: {container_path}"
        )

    # Validate mode
    if mode not in ["ro", "rw", "z", "Z"]:
        raise DockerValidationError(
            f"Invalid volume mode: {mode}. Use: ro, rw, z, or Z"
        )

    return host_path, container_path


def validate_volumes(volumes: Optional[str]) -> List[Tuple[str, str]]:
    """
    Validate volume mappings string.

    Format: "host:container" or "host1:container1,host2:container2"

    Args:
        volumes: Volume mappings string (comma-separated)

    Returns:
        List of validated volume tuples

    Raises:
        DockerValidationError: If any volume mapping is invalid
    """
    if not volumes:
        return []

    validated_volumes = []

    for mapping in volumes.split(","):
        mapping = mapping.strip()
        if not mapping:
            continue

        host_path, container_path = validate_volume_mapping(mapping)
        validated_volumes.append((host_path, container_path))

    return validated_volumes


def validate_env_vars(env_vars: Optional[dict]) -> dict:
    """
    Validate environment variables.

    Args:
        env_vars: Dictionary of environment variables

    Returns:
        Validated environment variables dict

    Raises:
        DockerValidationError: If env vars are invalid
    """
    if not env_vars:
        return {}

    if not isinstance(env_vars, dict):
        raise DockerValidationError("Environment variables must be a dictionary")

    validated = {}

    for key, value in env_vars.items():
        # Validate key format (must be valid shell variable name)
        if not re.match(r"^[a-zA-Z_][a-zA-Z0-9_]*$", key):
            raise DockerValidationError(
                f"Invalid environment variable name: {key}. Must start with letter or underscore and contain only alphanumeric and underscores"
            )

        # Convert value to string
        validated[key] = str(value)

    return validated


def validate_restart_policy(policy: str) -> str:
    """
    Validate Docker restart policy.

    Valid policies:
    - no: Do not automatically restart
    - always: Always restart
    - unless-stopped: Restart unless manually stopped
    - on-failure: Restart only on failure

    Args:
        policy: Restart policy

    Returns:
        Validated policy

    Raises:
        DockerValidationError: If policy is invalid
    """
    valid_policies = ["no", "always", "unless-stopped", "on-failure"]

    if policy not in valid_policies:
        raise DockerValidationError(
            f"Invalid restart policy: {policy}. Use: {', '.join(valid_policies)}"
        )

    return policy


def validate_memory_limit(memory: Optional[str]) -> Optional[str]:
    """
    Validate memory limit format.

    Format: number + unit (b, k, m, g)
    Examples: "512m", "1g", "100m"

    Args:
        memory: Memory limit string

    Returns:
        Validated memory string

    Raises:
        DockerValidationError: If memory format is invalid
    """
    if not memory:
        return None

    pattern = r"^[0-9]+[bkmg]$"
    if not re.match(pattern, memory.lower()):
        raise DockerValidationError(
            f"Invalid memory format: {memory}. Use: number + unit (b, k, m, g). Example: 512m, 1g"
        )

    return memory.lower()


def validate_cpu_limit(cpus: Optional[float]) -> Optional[float]:
    """
    Validate CPU limit.

    Args:
        cpus: Number of CPUs (e.g., 0.5, 1.0, 2.0)

    Returns:
        Validated CPU limit

    Raises:
        DockerValidationError: If CPU limit is invalid
    """
    if cpus is None:
        return None

    try:
        cpus = float(cpus)
    except (ValueError, TypeError):
        raise DockerValidationError(f"CPU limit must be a number: {cpus}")

    if cpus <= 0:
        raise DockerValidationError(f"CPU limit must be positive: {cpus}")

    if cpus > 64:
        raise DockerValidationError(f"CPU limit too high (max 64): {cpus}")

    return cpus


# Whitelist of allowed Docker images (optional security measure)
ALLOWED_IMAGES = [
    "nginx",
    "nginx:latest",
    "nginx:alpine",
    "postgres",
    "postgres:15",
    "postgres:14",
    "mysql",
    "mysql:8",
    "redis",
    "redis:alpine",
    "redis:7",
    "node",
    "node:18",
    "node:18-alpine",
    "python",
    "python:3.11",
    "python:3.11-slim",
    "ubuntu",
    "ubuntu:22.04",
    "alpine",
    "alpine:latest",
]


def validate_image_whitelist(image: str, whitelist: Optional[List[str]] = None) -> bool:
    """
    Check if image is in whitelist (optional security check).

    Args:
        image: Docker image name
        whitelist: List of allowed images (None = use default)

    Returns:
        True if allowed

    Raises:
        DockerValidationError: If image is not in whitelist
    """
    if whitelist is None:
        whitelist = ALLOWED_IMAGES

    # Check exact match
    if image in whitelist:
        return True

    # Check base image (without tag)
    base_image = image.split(":")[0]
    if base_image in whitelist:
        return True

    # Check if any whitelist entry matches (with wildcards)
    for allowed in whitelist:
        if "*" in allowed:
            pattern = allowed.replace("*", ".*")
            if re.match(f"^{pattern}$", image):
                return True

    raise DockerValidationError(
        f"Image not in whitelist: {image}. Contact administrator to add this image."
    )
