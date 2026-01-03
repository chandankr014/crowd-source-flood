from waitress import serve
from app import app
import os

if __name__ == "__main__":
    # Production-grade server that works on Windows and Linux
    port = int(os.getenv("PORT", 8005))
    print(f"Starting production server on http://127.0.0.1:{port}")
    serve(app, host="127.0.0.1", port=port, threads=int(os.getenv("THREADS", 4)))
