
import subprocess
import sys
import webbrowser
import time
import os
import socket
from threading import Thread

def is_port_in_use(port):
    """Проверяет, занят ли указанный порт"""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(('localhost', port)) == 0

def run_frontend():
    try:
        # Проверяем, занят ли порт 8080
        if is_port_in_use(8080):
            print("ОШИБКА: Порт 8080 уже используется. Убедитесь, что порт свободен.")
            sys.exit(1)
            
        npm_cmd = 'npm'
        if os.name == 'nt':  # Windows
            npm_cmd = r"npm.cmd"
        subprocess.run([npm_cmd, "run", "dev"], check=True)
    except subprocess.CalledProcessError as e:
        print(f"Ошибка запуска фронтенда: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"Неожиданная ошибка фронтенда: {e}")
        sys.exit(1)

def run_backend():
    try:
        # Проверяем, занят ли порт 5000
        if is_port_in_use(5000):
            print("ОШИБКА: Порт 5000 уже используется. Убедитесь, что порт свободен.")
            sys.exit(1)
            
        # Проверяем существование базы данных и создаем её структуру, если нужно
        ensure_database_exists()
            
        # Import the Flask app from routes.py
        from routes import app
        app.run(host='0.0.0.0', port=5000, debug=True, use_reloader=False)
    except ImportError:
        print("ОШИБКА: Не удалось импортировать Flask-приложение из routes.py")
        sys.exit(1)
    except Exception as e:
        print(f"Ошибка запуска бэкенда: {e}")
        sys.exit(1)

def ensure_database_exists():
    """Проверяет существование базы данных и её структуры"""
    db_path = os.path.join('database', 'database.db')
    if not os.path.exists('database'):
        os.makedirs('database', exist_ok=True)
        
    if not os.path.exists(db_path):
        try:
            print("База данных не найдена. Создание новой базы данных...")
            # Попытка импорта скрипта инициализации
            try:
                from database.init_db import init_db
                init_db()
                print("База данных успешно создана.")
            except ImportError:
                print("ПРЕДУПРЕЖДЕНИЕ: Не удалось импортировать init_db. База данных может быть не инициализирована.")
        except Exception as e:
            print(f"ОШИБКА при создании базы данных: {e}")

def open_browser():
    time.sleep(2)  # Wait for servers to start
    try:
        webbrowser.open('http://localhost:8080')
        print("Открываю браузер по адресу http://localhost:8080")
    except Exception as e:
        print(f"Не удалось открыть браузер: {e}")
        print("Пожалуйста, откройте приложение вручную по адресу http://localhost:8080")

if __name__ == "__main__":
    # Выводим информацию о запуске
    print("Запуск FatigueGuard...")
    
    # Ensure the video directory exists
    video_dir = os.path.join('neural_network', 'data', 'video')
    os.makedirs(video_dir, exist_ok=True)
    print(f"Папка для видео: {video_dir}")

    # Start backend in a separate thread
    print("Запуск бэкенда...")
    backend_thread = Thread(target=run_backend)
    backend_thread.daemon = True
    backend_thread.start()

    # Start frontend in a thread
    print("Запуск фронтенда...")
    frontend_thread = Thread(target=run_frontend)
    frontend_thread.daemon = True
    frontend_thread.start()

    # Open browser
    browser_thread = Thread(target=open_browser)
    browser_thread.daemon = True
    browser_thread.start()

    try:
        print("Приложение запущено. Нажмите CTRL+C для завершения...")
        # Keep the main thread alive
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nЗавершение работы серверов...")
        sys.exit(0)
