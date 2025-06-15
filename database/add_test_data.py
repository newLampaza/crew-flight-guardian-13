
import sqlite3
import os
from datetime import datetime, timedelta
import random
from werkzeug.security import generate_password_hash

# Import date utilities
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from utils.date_utils import get_current_datetime, format_datetime_for_db, get_cooldown_end

# Database path
db_path = os.path.join('database.db')

# Connect to database
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Clear existing data (optional, comment out if not needed)
tables = [
    'TestMistakes', 'CognitiveTests', 'MedicalChecks', 
    'FatigueAnalysisFeedback', 'FlightFeedback', 'FatigueAnalysis', 
    'CrewMembers', 'Flights', 'Crews', 'Users', 'Employees',
    'FatigueVideos', 'TestSessions', 'TestImages'
]

for table in tables:
    cursor.execute(f'DELETE FROM {table}')

print("Очистка существующих данных завершена")

# Add test employees
employees_data = [
    ('Иванов Иван', 'pilot', 'Командир воздушного судна', 'ivanov@example.com', '2020-01-15', 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=400&auto=format&fit=crop&q=60'),
    ('Петров Петр', 'pilot', 'Второй пилот', 'petrov@example.com', '2019-05-20', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=60'),
    ('Сидорова Анна', 'medical', 'Врач', 'sidorova@example.com', '2021-03-10', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&auto=format&fit=crop&q=60'),
    ('Кузнецова Мария', 'admin', 'Администратор', 'kuznetsova@example.com', '2018-07-22', 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&auto=format&fit=crop&q=60')
]

for emp in employees_data:
    cursor.execute('''
        INSERT INTO Employees (name, role, position, contact_info, employment_date, image_url)
        VALUES (?, ?, ?, ?, ?, ?)
    ''', emp)

print("Сотрудники добавлены")

# Add users with hashed passwords
for i in range(1, 5):
    username = f"user{i}"
    password = generate_password_hash("password123")
    role = cursor.execute('SELECT role FROM Employees WHERE employee_id = ?', (i,)).fetchone()[0]
    
    cursor.execute('''
        INSERT INTO Users (employee_id, username, password, role)
        VALUES (?, ?, ?, ?)
    ''', (i, username, password, role))

print("Пользователи добавлены")

# Add test crews
cursor.execute("INSERT INTO Crews (crew_name) VALUES ('Экипаж А')")
cursor.execute("INSERT INTO Crews (crew_name) VALUES ('Экипаж Б')")

# Add crew members
crew_members_data = [
    (1, 1, 'commander'),
    (1, 2, 'co-pilot'),
    (2, 2, 'commander')
]

for crew in crew_members_data:
    cursor.execute('''
        INSERT INTO CrewMembers (crew_id, employee_id, role)
        VALUES (?, ?, ?)
    ''', crew)

print("Экипажи созданы")

# Generate test flights with proper ISO datetime format
airports = [
    ('SVO', 'Москва'), ('LED', 'Санкт-Петербург'), ('KZN', 'Казань'),
    ('OVB', 'Новосибирск'), ('AER', 'Сочи'), ('ROV', 'Ростов-на-Дону'),
    ('SVX', 'Екатеринбург')
]
aircrafts = ['Boeing 737', 'Airbus A320', 'Superjet 100', 'Boeing 777']
conditions_list = ['Normal', 'Bad weather', 'Maintenance', 'Delayed']

now = datetime.now()
flight_id = 1

for crew_id in [1, 2]:
    for day_delta in range(-30, 31):  # ±1 месяц от текущей даты
        date = now + timedelta(days=day_delta)
        departure_hour = random.choice([6, 8, 12, 15, 18, 21])
        journey_time_min = random.choice([80, 100, 120, 145, 170])
        from_airport, from_city = random.choice(airports)
        to_airport, to_city = random.choice([ap for ap in airports if ap[0] != from_airport])
        departure = date.replace(hour=departure_hour, minute=0, second=0, microsecond=0)
        arrival = departure + timedelta(minutes=journey_time_min)
        aircraft = random.choice(aircrafts)
        conditions = random.choice(conditions_list)
        flight_number = f"SU{str(flight_id).zfill(4)}"
        
        video_path = f"flight_{flight_id}_{from_airport}_{to_airport}.mp4"
        
        cursor.execute('''
            INSERT INTO Flights (
                crew_id, flight_number, departure_time, arrival_time,
                from_code, from_city, to_code, to_city,
                aircraft, conditions, video_path
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            crew_id, flight_number, 
            format_datetime_for_db(departure), 
            format_datetime_for_db(arrival),
            from_airport, from_city,
            to_airport, to_city,
            aircraft, conditions, video_path
        ))
        
        flight_id += 1

print(f"Создано {flight_id - 1} рейсов")

# Add medical checks
medical_checks_data = [
    (1, '2024-01-01', '2025-01-01', 'passed', 'Dr. Smith', 'Regular check'),
    (2, '2024-01-15', '2025-01-15', 'passed', 'Dr. Johnson', 'Regular check')
]

for check in medical_checks_data:
    cursor.execute('''
        INSERT INTO MedicalChecks (
            employee_id, check_date, expiry_date,
            status, doctor_name, notes
        )
        VALUES (?, ?, ?, ?, ?, ?)
    ''', check)

print("Медицинские осмотры добавлены")

# Add cognitive tests with proper datetime format and cooldown
current_time = datetime.now()
cognitive_tests_data = [
    (1, format_datetime_for_db(current_time - timedelta(hours=2)), 'attention', 95.5, 300, '{"questions": 20, "correct": 19}', get_cooldown_end(30)),
    (1, format_datetime_for_db(current_time - timedelta(hours=3)), 'memory', 88.0, 240, '{"questions": 15, "correct": 13}', None),
    (2, format_datetime_for_db(current_time - timedelta(hours=1)), 'reaction', 92.5, 180, '{"questions": 10, "correct": 9}', get_cooldown_end(45))
]

for test in cognitive_tests_data:
    cursor.execute('''
        INSERT INTO CognitiveTests (
            employee_id, test_date, test_type,
            score, duration, details, cooldown_end
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ''', test)

print("Когнитивные тесты добавлены")

# Add fatigue analysis data with new structure
fatigue_levels = ['Low', 'Medium', 'High']
analysis_types = ['flight', 'realtime']

# Flight analyses - for specific flights
sample_flight_ids = [1, 2, 3, 5, 8, 10, 15, 20, 25, 30]
for i, flight_id in enumerate(sample_flight_ids):
    cursor.execute('SELECT from_code, to_code, video_path FROM Flights WHERE flight_id = ?', (flight_id,))
    flight_data = cursor.fetchone()
    
    if flight_data:
        from_code, to_code, video_path = flight_data
        employee_id = random.choice([1, 2])
        fatigue_level = random.choice(fatigue_levels)
        neural_score = random.uniform(0.1, 0.9)
        
        cursor.execute('''
            INSERT INTO FatigueAnalysis (
                employee_id, flight_id, analysis_type, fatigue_level, 
                neural_network_score, analysis_date, video_path, notes,
                resolution, fps
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            employee_id, flight_id, 'flight', fatigue_level, neural_score,
            format_datetime_for_db(current_time - timedelta(hours=i)), video_path,
            f'Анализ рейса {from_code}-{to_code}',
            '640x480', 30.0
        ))

# Realtime analyses - not tied to flights
for i in range(10):
    employee_id = random.choice([1, 2])
    fatigue_level = random.choice(fatigue_levels)
    neural_score = random.uniform(0.1, 0.9)
    video_path = f"realtime_analysis_{i+1}.mp4"
    
    cursor.execute('''
        INSERT INTO FatigueAnalysis (
            employee_id, flight_id, analysis_type, fatigue_level, 
            neural_network_score, analysis_date, video_path, notes,
            resolution, fps
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        employee_id, None, 'realtime', fatigue_level, neural_score,
        format_datetime_for_db(current_time - timedelta(minutes=i*30)), video_path,
        f'Анализ усталости в реальном времени #{i+1}',
        '640x480', 30.0
    ))

print("Анализы усталости добавлены")

# Add separate feedback for flights and fatigue analyses
# Flight feedback
flight_feedback_data = [
    (1, 1, 5, 'Отличный рейс, минимальная усталость'),
    (2, 2, 3, 'Средняя нагрузка во время полета'),
    (1, 3, 4, 'Хороший рейс, но была турбулентность'),
    (2, 5, 5, 'Комфортный полет'),
]

for feedback in flight_feedback_data:
    cursor.execute('''
        INSERT INTO FlightFeedback (
            employee_id, flight_id, rating, comments
        )
        VALUES (?, ?, ?, ?)
    ''', feedback)

# Fatigue analysis feedback
fatigue_feedback_data = [
    (1, 1, 5, 'Анализ точно определил уровень усталости'),
    (1, 2, 4, 'Хороший анализ, полезная информация'),
    (2, 3, 5, 'Очень точный анализ состояния'),
    (2, 4, 3, 'Анализ был не совсем точным'),
]

for feedback in fatigue_feedback_data:
    cursor.execute('''
        INSERT INTO FatigueAnalysisFeedback (
            employee_id, analysis_id, rating, comments
        )
        VALUES (?, ?, ?, ?)
    ''', feedback)

print("Отзывы добавлены")

# Commit changes and close connection
conn.commit()
conn.close()

print("Тестовые данные успешно добавлены в обновленную базу данных!")
print("Структура БД включает:")
print("- Правильные форматы дат (ISO 8601)")
print("- Раздельные таблицы отзывов для рейсов и анализов усталости")
print("- Анализы усталости с типами 'flight' и 'realtime'")
print("- Индексы для оптимизации производительности")
print("- Триггеры для автоматического расчета длительности рейсов")
