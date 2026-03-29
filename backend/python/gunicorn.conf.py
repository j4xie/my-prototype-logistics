"""
Gunicorn configuration for Cretas Python Services.

Replaces single-worker Uvicorn for production.
3 workers allow parallel request handling despite GIL.

Usage:
    gunicorn main:app -c gunicorn.conf.py
"""

import os

# Bind
bind = f"0.0.0.0:{os.environ.get('PORT', '8083')}"

# Workers: 3 for 8C/16GB shared server (Java + PG + Redis also running)
# Each worker ~500MB-1GB with loaded ML models
# Reduce to 2 if memory exceeds 12GB total
workers = int(os.environ.get("PYTHON_WORKERS", "3"))

# Uvicorn worker class for async support
worker_class = "uvicorn.workers.UvicornWorker"

# Timeout: 120s to handle large Excel processing
timeout = 120

# Graceful shutdown: 30s to finish in-flight requests
graceful_timeout = 30

# Restart workers periodically to prevent memory leaks
max_requests = 1000
max_requests_jitter = 100

# Logging
accesslog = "-"  # stdout
errorlog = "-"   # stderr
loglevel = os.environ.get("LOG_LEVEL", "info")

# Preload app to share memory across workers (copy-on-write)
preload_app = True

# Worker temp directory (use memory-backed tmpfs if available)
worker_tmp_dir = "/dev/shm" if os.path.isdir("/dev/shm") else None
