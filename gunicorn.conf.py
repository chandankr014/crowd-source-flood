import os
import signal

# Server socket
bind = "0.0.0.0:8005"
backlog = 2048

# Worker processes
# Use a conservative default to avoid OOM on constrained HPC nodes
# Formula: (2 x num_cores) + 1 is standard, but we'll cap it or use env var
workers = int(os.getenv('WORKERS', 1))
worker_class = 'geventwebsocket.gunicorn.workers.GeventWebSocketWorker'
threads = int(os.getenv('THREADS', 1))  # Use 1 thread per worker to avoid threading issues
timeout = 120
keepalive = 5
graceful_timeout = 30  # Give workers time to finish ongoing requests

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

# Daemon mode - disable to ensure proper cleanup
daemon = False

# Worker lifecycle hooks to ensure cleanup
def on_starting(server):
    """Called just before the master process is initialized."""
    print(f"Gunicorn master starting with PID {os.getpid()}")

def on_reload(server):
    """Called to recycle workers during a reload via SIGHUP."""
    print("Gunicorn master reloading")

def when_ready(server):
    """Called just after the server is started."""
    print(f"Gunicorn master ready. Workers: {workers}")

def post_fork(server, worker):
    """Called just after a worker has been forked."""
    print(f"Worker spawned (pid: {worker.pid})")

def pre_exec(server):
    """Called just before a new master process is forked."""
    print("Forking new master process")

def post_worker_init(worker):
    """Called just after a worker has initialized the application."""
    print(f"Worker {worker.pid} initialized")

def worker_int(worker):
    """Called when a worker receives the INT or QUIT signal."""
    print(f"Worker {worker.pid} received INT/QUIT signal")
    # Ensure clean shutdown
    worker.log.info(f"Worker {worker.pid} shutting down gracefully")

def worker_abort(worker):
    """Called when a worker receives the ABRT signal (timeout)."""
    print(f"Worker {worker.pid} timed out (aborted)")
    worker.log.error(f"Worker {worker.pid} aborted (timeout)")

def worker_exit(server, worker):
    """Called just after a worker has been exited."""
    print(f"Worker {worker.pid} exited")

def on_exit(server):
    """Called just before the master process exits."""
    print(f"Gunicorn master exiting (PID {os.getpid()})")
    # Ensure all workers are terminated
    for worker in server.WORKERS.values():
        try:
            os.kill(worker.pid, signal.SIGTERM)
        except (OSError, ProcessLookupError):
            pass
