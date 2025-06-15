
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

# --- Generate flights for current, previous, and next week (each day: 0–4 flights) ---

airports = [
    ('SVO', 'Москва'), ('LED', 'Санкт-Петербург'), ('KZN', 'Казань'),
    ('OVB', 'Новосибирск'), ('AER', 'Сочи'), ('ROV', 'Ростов-на-Дону'),
    ('SVX', 'Екатеринбург')
]
aircrafts = ['Boeing 737', 'Airbus A320', 'Superjet 100', 'Boeing 777']
conditions_list = ['Normal', 'Bad weather', 'Maintenance', 'Delayed']

now = datetime.now()
today = now.date()
# Find start of current, previous and next week (weeks start on Monday as per ISO)
this_monday = today - timedelta(days=today.weekday())
dates = []

# Create dates for previous, current, next week
for week_offset in (-1, 0, 1):
    monday = this_monday + timedelta(weeks=week_offset)
    for day_delta in range(7):
        day = monday + timedelta(days=day_delta)
        dates.append(day)

flight_id = 1

for crew_id in [1, 2]:
    for date in dates:
        num_flights = random.randint(0, 4)
        departure_hours = random.sample([6, 8, 12, 15, 18, 21], k=num_flights) if num_flights <= 6 else [6, 8, 12, 15, 18, 21]
        for i in range(num_flights):
            journey_time_min = random.choice([80, 100, 120, 145, 170])
            from_airport, from_city = random.choice(airports)
            # Don't let departure and arrival airports be the same
            to_airport, to_city = random.choice([ap for ap in airports if ap[0] != from_airport])
            departure = datetime.combine(date, datetime.min.time()).replace(hour=departure_hours[i], minute=0)
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

print("Рейсы созданы для прошлой, текущей и будущей недели (по 0–4 на день)")

# --- Medical, Cognitive Tests, Feedback, но БЕЗ FatigueAnalysis и FatigueAnalysisFeedback ---

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

# Add flight feedback (примеры, не связаны с анализами усталости)
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

print("Отзывы к рейсам добавлены")

# Commit changes and close connection
conn.commit()
conn.close()

print("Тестовые данные успешно добавлены в обновленную базу данных! (анализы усталости и их отзывы не создаются)")
print("Рейсы только в пределах прошлой, текущей и будущей недели, в день рандомно 0–4 рейса.")

