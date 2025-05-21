
import subprocess
import sys
import webbrowser
import time
import os
from threading import Thread

def run_frontend():
    try:
        npm_cmd = 'npm'
        if os.name == 'nt':  # Windows
            npm_cmd = r"npm.cmd"
        subprocess.run([npm_cmd, "run", "dev"], check=True)
    except subprocess.CalledProcessError as e:
        print(f"Frontend error: {e}")
        sys.exit(1)

def run_backend():
    try:
        # Import the Flask app from routes.py
        from routes import app
        app.run(host='0.0.0.0', port=5000, debug=True, use_reloader=False)
    except Exception as e:
        print(f"Backend error: {e}")
        sys.exit(1)

def open_browser():
    time.sleep(2)  # Wait for servers to start
    webbrowser.open('http://localhost:8080')

if __name__ == "__main__":
    # Ensure the video directory exists
    video_dir = os.path.join('neural_network', 'data', 'video')
    os.makedirs(video_dir, exist_ok=True)

    # Start backend in a separate thread
    backend_thread = Thread(target=run_backend)
    backend_thread.daemon = True
    backend_thread.start()

    # Start frontend in a thread
    frontend_thread = Thread(target=run_frontend)
    frontend_thread.daemon = True
    frontend_thread.start()

    # Open browser
    browser_thread = Thread(target=open_browser)
    browser_thread.daemon = True
    browser_thread.start()

    try:
        # Keep the main thread alive
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nShutting down servers...")
        sys.exit(0)
