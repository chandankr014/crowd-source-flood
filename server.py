from app import app, socketio
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
    port = int(os.getenv("PORT", 9009))
    host = os.getenv("HOST", "0.0.0.0")
    
    print(f"Starting Flask-SocketIO server on http://{host}:{port}")
    print("Press Ctrl+C to stop")
    
    try:
        socketio.run(
            app,
            host=host,
            port=port,
            debug=False,
            allow_unsafe_werkzeug=True
        )
    except KeyboardInterrupt:
        print("\nShutting down...")
    finally:
        print("Server stopped cleanly")
