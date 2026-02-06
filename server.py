from waitress import serve
from app import app
import os
import signal
import sys

# Graceful shutdown handler
def signal_handler(signum, frame):
    """Handle shutdown signals gracefully"""
    print(f"\nReceived signal {signum}. Shutting down gracefully...")
    sys.exit(0)

# Register signal handlers
signal.signal(signal.SIGINT, signal_handler)
signal.signal(signal.SIGTERM, signal_handler)

if __name__ == "__main__":
    # Production-grade server that works on Windows and Linux
    port = int(os.getenv("PORT", 9009))
    host = os.getenv("HOST", "0.0.0.0")
    threads = int(os.getenv("WAITRESS_THREADS", 4))
    
    print(f"Starting Waitress production server on http://{host}:{port}")
    print(f"Threads: {threads}")
    print("Press Ctrl+C to stop")
    
    try:
        serve(
            app, 
            host=host, 
            port=port, 
            threads=threads,
            ident="airesq-crowdsourcing",
            backlog=128,
            connection_limit=256,
            channel_timeout=120,
            cleanup_interval=30,  # Cleanup inactive connections
            asyncore_use_poll=True  # Better performance on Windows
        )
    except KeyboardInterrupt:
        print("\nShutting down...")
    finally:
        print("Server stopped cleanly")
