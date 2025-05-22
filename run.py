
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
        
    # Проверяем, существует ли база данных или её нужно пересоздать
    needs_init = not os.path.exists(db_path)
    
    if needs_init:
        try:
            print("База данных не найдена. Создание новой базы данных...")
            # Попытка импорта скрипта инициализации
            try:
                # Убедимся, что мы находимся в корневой папке проекта
                current_dir = os.getcwd()
                sys.path.append(current_dir)
                
                from database.init_db import init_db
                init_db()
                print("База данных успешно создана.")
            except ImportError:
                print("Импортируем и запускаем init_db.py напрямую...")
                # Если нет функции init_db, выполняем файл напрямую
                db_init_path = os.path.join('database', 'init_db.py')
                if os.path.exists(db_init_path):
                    current_path = os.getcwd()
                    db_dir = os.path.join(current_path, 'database')
                    subprocess.run([sys.executable, db_init_path], cwd=db_dir, check=True)
                    print("База данных успешно создана.")
                else:
                    print("ОШИБКА: Файл init_db.py не найден")
            
            # Проверяем наличие основных таблиц после создания
            import sqlite3
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
            tables = cursor.execute("SELECT name FROM sqlite_master WHERE type='table';").fetchall()
            tables = [table[0] for table in tables]
            conn.close()
            
            required_tables = ['Users', 'Employees', 'FatigueVideos', 'FatigueAnalysis']
            missing_tables = [table for table in required_tables if table not in tables]
            
            if missing_tables:
                print(f"ПРЕДУПРЕЖДЕНИЕ: После инициализации отсутствуют таблицы: {', '.join(missing_tables)}")
                print("Возможно, потребуется обновить схему базы данных.")
            else:
                print("Все необходимые таблицы успешно созданы.")
                
        except Exception as e:
            print(f"ОШИБКА при создании базы данных: {e}")
            import traceback
            traceback.print_exc()

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

