# syntax=docker/dockerfile:1
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# System deps for common Python packages and ansible-runner
RUN apt-get update -y \
    && apt-get install -y --no-install-recommends \
       build-essential \
        libffi-dev \
        libssl-dev \
        git \
        openssh-client \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install
COPY server/requirements.txt server/requirements.txt
RUN pip install --no-cache-dir -r server/requirements.txt

# Copy app code
COPY server /app/server

# Ensure entrypoint is executable
RUN chmod +x /app/server/entrypoint.sh

EXPOSE 8000

ENV APP_DIR=/app

ENTRYPOINT ["/app/server/entrypoint.sh"]
