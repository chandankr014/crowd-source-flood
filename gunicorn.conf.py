import os
import multiprocessing

# Server socket
bind = "0.0.0.0:8005"
backlog = 2048

# Worker processes
# Use a conservative default to avoid OOM on constrained HPC nodes
# Formula: (2 x num_cores) + 1 is standard, but we'll cap it or use env var
workers = int(os.getenv('WORKERS', 2))
worker_class = 'sync'
threads = int(os.getenv('THREADS', 2))
timeout = 120
keepalive = 5

# Process naming
proc_name = 'airesq_crowdsourcing'

# Logging
accesslog = '-'
errorlog = '-'
loglevel = 'info'

# Process management - CRITICAL for stability
# Restart workers after this many requests to prevent memory leaks
max_requests = 1000
max_requests_jitter = 50

# Preload app to save memory and startup time
preload_app = True
