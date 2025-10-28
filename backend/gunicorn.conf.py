import os

bind = "0.0.0.0:5000"
workers = int(os.getenv("GUNICORN_WORKERS", "3"))
worker_class = "sync"
timeout = 120
keepalive = 5
accesslog = "-"
errorlog = "-"
loglevel = "info"
preload_app = True
graceful_timeout = 30
max_requests = 1000
max_requests_jitter = 50