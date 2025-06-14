
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
            
        # Проверяем существование базы данных и выполняем миграцию при необходимости
        ensure_database_updated()
            
        # Import the Flask app from routes.py
        from routes import app
        app.run(host='0.0.0.0', port=5000, debug=True, use_reloader=False)
    except ImportError:
        print("ОШИБКА: Не удалось импортировать Flask-приложение из routes.py")
        sys.exit(1)
    except Exception as e:
        print(f"Ошибка запуска бэкенда: {e}")
        sys.exit(1)

def check_database_version():
    """Проверяет версию схемы базы данных"""
    db_path = os.path.join('database', 'database.db')
    if not os.path.exists(db_path):
        return None
        
    try:
        import sqlite3
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Проверяем наличие устаревших таблиц
        tables = cursor.execute("SELECT name FROM sqlite_master WHERE type='table';").fetchall()
        table_names = [table[0] for table in tables]
        
        # Если есть устаревшие таблицы, значит схема старая
        deprecated_tables = ['FatigueVideos', 'TestMistakes', 'TestSessions', 'TestImages']
        has_deprecated = any(table in table_names for table in deprecated_tables)
        
        # Проверяем формат datetime в таблице Flights
        has_mixed_datetime = False
        if 'Flights' in table_names:
            sample_flight = cursor.execute("SELECT departure_time FROM Flights LIMIT 1").fetchone()
            if sample_flight and sample_flight[0]:
                # Если время содержит 'T', то это уже новый формат
                has_mixed_datetime = 'T' not in sample_flight[0]
        
        conn.close()
        
        if has_deprecated or has_mixed_datetime:
            return 'v1'  # Старая версия
        else:
            return 'v2'  # Новая версия
            
    except Exception as e:
        print(f"Ошибка проверки версии БД: {e}")
        return None

def ensure_database_updated():
    """Проверяет и обновляет базу данных при необходимости"""
    db_path = os.path.join('database', 'database.db')
    
    if not os.path.exists('database'):
        os.makedirs('database', exist_ok=True)
    
    version = check_database_version()
    
    if version is None:
        # База данных не существует, создаем новую
        print("База данных не найдена. Создание новой базы данных v2...")
        try:
            current_dir = os.getcwd()
            sys.path.append(current_dir)
            sys.path.append(os.path.join(current_dir, 'database'))
            
            from database.schema_v2 import init_db_v2
            init_db_v2()
            
            # Добавляем тестовые данные
            from database.add_test_data_v2 import add_test_data_v2
            add_test_data_v2()
            
            print("База данных v2 успешно создана с тестовыми данными.")
            
        except Exception as e:
            print(f"ОШИБКА при создании базы данных: {e}")
            import traceback
            traceback.print_exc()
            
    elif version == 'v1':
        # Нужна миграция
        print("Обнаружена старая версия базы данных. Выполняется миграция на v2...")
        try:
            current_dir = os.getcwd()
            sys.path.append(current_dir)
            sys.path.append(os.path.join(current_dir, 'database'))
            
            from database.migrate_v1_to_v2 import migrate_v1_to_v2
            migrate_v1_to_v2()
            
            print("Миграция базы данных успешно завершена.")
            
        except Exception as e:
            print(f"ОШИБКА при миграции базы данных: {e}")
            import traceback
            traceback.print_exc()
            
    else:
        print("База данных актуальна (v2).")

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
