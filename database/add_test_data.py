
import sqlite3
import os
from datetime import datetime, timedelta
import random
from werkzeug.security import generate_password_hash

# Database path
db_path = os.path.join('database.db')

# Connect to database
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Clear existing data (optional, comment out if not needed)
tables = [
    'TestMistakes', 'CognitiveTests', 'MedicalChecks', 
    'FatigueAnalysis', 'CrewMembers', 'Flights', 'Crews',
    'Users', 'Employees'
]

for table in tables:
    cursor.execute(f'DELETE FROM {table}')

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

# Add users with hashed passwords
for i in range(1, 5):
    username = f"user{i}"
    password = generate_password_hash("password123")
    role = cursor.execute('SELECT role FROM Employees WHERE employee_id = ?', (i,)).fetchone()[0]
    
    cursor.execute('''
        INSERT INTO Users (employee_id, username, password, role)
        VALUES (?, ?, ?, ?)
    ''', (i, username, password, role))

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

# Генерация большого набора тестовых рейсов
airports = [
    ('SVO', 'Москва'), ('LED', 'Санкт-Петербург'), ('KZN', 'Казань'),
    ('OVB', 'Новосибирск'), ('AER', 'Сочи'), ('ROV', 'Ростов-на-Дону'),
    ('SVX', 'Екатеринбург')
]
aircrafts = ['Boeing 737', 'Airbus A320', 'Superjet 100', 'Boeing 777']
conditions_list = ['Normal', 'Bad weather', 'Maintenance', 'Delayed']

# Для 2 экипажей и 2 месяцев в обе стороны
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
        
        # Генерация video_path для рейса (только filename без пути)
        video_path = f"flight_{flight_id}_{from_airport}_{to_airport}.mp4"
        
        cursor.execute('''
            INSERT INTO Flights (
                crew_id, flight_number, departure_time, arrival_time,
                from_code, from_city, to_code, to_city,
                aircraft, conditions, video_path
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            crew_id, flight_number, 
            departure.strftime('%Y-%m-%dT%H:%M:%S'), 
            arrival.strftime('%Y-%m-%dT%H:%M:%S'),
            from_airport, from_city,
            to_airport, to_city,
            aircraft, conditions, video_path
        ))
        
        flight_id += 1

# Add some classic test flights for demo scenarios
demo_flights = [
    (1, 'SU1234', now + timedelta(days=1), now + timedelta(days=1, hours=3), 'SVO', 'Москва', 'LED', 'Санкт-Петербург', 'Boeing 737', 'Normal'),
    (1, 'SU1235', now + timedelta(days=2), now + timedelta(days=2, hours=6), 'LED', 'Санкт-Петербург', 'SVO', 'Москва', 'Boeing 737', 'Normal'),
    (2, 'SU1236', now + timedelta(days=3), now + timedelta(days=3, hours=4), 'SVO', 'Москва', 'KZN', 'Казань', 'Airbus A320', 'Normal')
]

for flight in demo_flights:
    video_path = f"flight_{flight_id}_{flight[4]}_{flight[6]}.mp4"
    cursor.execute('''
        INSERT INTO Flights (
            crew_id, flight_number, departure_time, arrival_time,
            from_code, from_city, to_code, to_city,
            aircraft, conditions, video_path
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        flight[0], flight[1], 
        flight[2].strftime('%Y-%m-%dT%H:%M:%S'),
        flight[3].strftime('%Y-%m-%dT%H:%M:%S'),
        flight[4], flight[5], flight[6], flight[7], flight[8], flight[9], video_path
    ))
    flight_id += 1

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

# Add cognitive tests
cognitive_tests_data = [
    (1, datetime.now().isoformat(), 'attention', 95.5, 300, '{"questions": 20, "correct": 19}'),
    (1, datetime.now().isoformat(), 'memory', 88.0, 240, '{"questions": 15, "correct": 13}'),
    (2, datetime.now().isoformat(), 'reaction', 92.5, 180, '{"questions": 10, "correct": 9}')
]

for test in cognitive_tests_data:
    cursor.execute('''
        INSERT INTO CognitiveTests (
            employee_id, test_date, test_type,
            score, duration, details
        )
        VALUES (?, ?, ?, ?, ?, ?)
    ''', test)

# Add test fatigue analysis data
fatigue_levels = ['Low', 'Medium', 'High']
now_iso = datetime.now().isoformat()

# Добавляем анализы усталости для некоторых рейсов
sample_flight_ids = [1, 2, 3, 5, 8, 10, 15, 20, 25, 30]
for i, flight_id in enumerate(sample_flight_ids):
    # Получаем данные рейса для video_path
    cursor.execute('SELECT from_code, to_code, video_path FROM Flights WHERE flight_id = ?', (flight_id,))
    flight_data = cursor.fetchone()
    
    if flight_data:
        from_code, to_code, video_path = flight_data
        employee_id = random.choice([1, 2])  # Случайный пилот
        fatigue_level = random.choice(fatigue_levels)
        neural_score = random.uniform(0.1, 0.9)
        feedback_score = random.randint(1, 5)
        
        cursor.execute('''
            INSERT INTO FatigueAnalysis (
                employee_id, flight_id, fatigue_level, neural_network_score,
                feedback_score, analysis_date, video_path, notes,
                resolution, fps
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            employee_id, flight_id, fatigue_level, neural_score,
            feedback_score, now_iso, video_path, 
            f'Анализ рейса {from_code}-{to_code}',
            '640x480', 30.0
        ))

# Add test feedback data
feedback_data = [
    (1, 'flight', 1, 5, 'Отличный рейс, минимальная усталость'),
    (1, 'cognitive_test', 1, 4, 'Тест был информативным'),
    (2, 'fatigue_analysis', 1, 5, 'Точный анализ состояния'),
    (2, 'flight', 2, 3, 'Средняя нагрузка во время полета'),
    (1, 'cognitive_test', 2, 5, 'Хорошо структурированный тест')
]

for feedback in feedback_data:
    cursor.execute('''
        INSERT INTO Feedback (
            employee_id, entity_type, entity_id,
            rating, comments
        )
        VALUES (?, ?, ?, ?, ?)
    ''', feedback)

# Commit changes and close connection
conn.commit()
conn.close()

print("Тестовые данные успешно добавлены в базу данных!")
print("Добавлены video_path для всех рейсов и тестовые данные анализа усталости.")
print("Примеры video_path: flight_1_SVO_LED.mp4, flight_2_KZN_OVB.mp4, и т.д.")
