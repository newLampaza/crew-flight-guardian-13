
import sqlite3
import os

# Database path setup
db_path = os.path.join('database.db')

# Connect to database
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Create tables with proper schemas

# Users table with enhanced authentication fields
cursor.execute('''
CREATE TABLE IF NOT EXISTS Users (
    user_id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER UNIQUE,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    role TEXT CHECK(role IN ('pilot', 'admin', 'medical')) NOT NULL,
    last_login TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES Employees (employee_id)
)
''')

# Employees table with extended fields
cursor.execute('''
CREATE TABLE IF NOT EXISTS Employees (
    employee_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    position TEXT,
    contact_info TEXT,
    employment_date TEXT,
    image_url TEXT,
    status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'on_leave'))
)
''')

# Crews table
cursor.execute('''
CREATE TABLE IF NOT EXISTS Crews (
    crew_id INTEGER PRIMARY KEY AUTOINCREMENT,
    crew_name TEXT NOT NULL,
    status TEXT DEFAULT 'active'
)
''')

# Crew Members relationship table
cursor.execute('''
CREATE TABLE IF NOT EXISTS CrewMembers (
    crew_id INTEGER,
    employee_id INTEGER,
    role TEXT NOT NULL,
    join_date TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (crew_id) REFERENCES Crews (crew_id),
    FOREIGN KEY (employee_id) REFERENCES Employees (employee_id),
    PRIMARY KEY (crew_id, employee_id)
)
''')

# Flights table with extended tracking
cursor.execute('''
CREATE TABLE IF NOT EXISTS Flights (
    flight_id INTEGER PRIMARY KEY AUTOINCREMENT,
    crew_id INTEGER,
    flight_number TEXT,
    departure_time TEXT NOT NULL,
    arrival_time TEXT NOT NULL,
    duration INTEGER,
    from_code TEXT NOT NULL,
    from_city TEXT NOT NULL,
    to_code TEXT NOT NULL,
    to_city TEXT NOT NULL,
    aircraft TEXT NOT NULL,
    conditions TEXT,
    status TEXT DEFAULT 'scheduled' CHECK(status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
    video_path TEXT,
    FOREIGN KEY (crew_id) REFERENCES Crews (crew_id)
)
''')

# Add missing FatigueVideos table
cursor.execute('''
CREATE TABLE IF NOT EXISTS FatigueVideos (
    video_id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL,
    video_path TEXT NOT NULL,
    upload_date TEXT NOT NULL,
    original_filename TEXT,
    resolution TEXT,
    fps REAL,
    duration INTEGER,
    FOREIGN KEY (employee_id) REFERENCES Employees (employee_id)
)
''')

# Fatigue Analysis table with detailed metrics - UPDATED CHECK constraint to include 'Saved'
cursor.execute('''
CREATE TABLE IF NOT EXISTS FatigueAnalysis (
    analysis_id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER,
    flight_id INTEGER,
    fatigue_level TEXT CHECK(fatigue_level IN ('Low', 'Medium', 'High', 'Unknown', 'Saved')),
    neural_network_score REAL,
    feedback_score REAL,
    analysis_date TEXT,
    video_path TEXT,
    notes TEXT,
    resolution TEXT,
    fps REAL,
    FOREIGN KEY (employee_id) REFERENCES Employees (employee_id),
    FOREIGN KEY (flight_id) REFERENCES Flights (flight_id)
)
''')

# Medical Checks table
cursor.execute('''
CREATE TABLE IF NOT EXISTS MedicalChecks (
    check_id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL,
    check_date TEXT NOT NULL,
    expiry_date TEXT NOT NULL,
    status TEXT CHECK(status IN ('passed', 'conditionally_passed', 'failed')),
    doctor_name TEXT,
    notes TEXT,
    FOREIGN KEY (employee_id) REFERENCES Employees (employee_id)
)
''')

# Cognitive Tests table with cooldown_end column added
cursor.execute('''
CREATE TABLE IF NOT EXISTS CognitiveTests (
    test_id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL,
    test_date TEXT NOT NULL,
    test_type TEXT CHECK(test_type IN ('attention', 'memory', 'reaction', 'cognitive')),
    score REAL NOT NULL,
    duration INTEGER NOT NULL,
    details TEXT,
    cooldown_end TEXT,
    FOREIGN KEY (employee_id) REFERENCES Employees (employee_id)
)
''')

# Test Mistakes tracking
cursor.execute('''
CREATE TABLE IF NOT EXISTS TestMistakes (
    mistake_id INTEGER PRIMARY KEY AUTOINCREMENT,
    test_id INTEGER NOT NULL,
    question TEXT NOT NULL,
    user_answer TEXT,
    correct_answer TEXT NOT NULL,
    FOREIGN KEY (test_id) REFERENCES CognitiveTests(test_id)
)
''')

# Test Sessions for managing ongoing tests
cursor.execute('''
CREATE TABLE IF NOT EXISTS TestSessions (
    session_id TEXT PRIMARY KEY,
    employee_id INTEGER NOT NULL,
    test_type TEXT NOT NULL,
    start_time TEXT NOT NULL,
    questions TEXT NOT NULL,
    FOREIGN KEY (employee_id) REFERENCES Employees (employee_id)
)
''')

# Feedback table for storing user feedback
cursor.execute('''
CREATE TABLE IF NOT EXISTS Feedback (
    feedback_id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL,
    entity_type TEXT CHECK(entity_type IN ('flight', 'cognitive_test', 'fatigue_analysis')) NOT NULL,
    entity_id INTEGER NOT NULL,
    rating INTEGER CHECK(rating BETWEEN 1 AND 5) NOT NULL,
    comments TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES Employees (employee_id)
)
''')

# Test Images for cognitive tests
cursor.execute('''
CREATE TABLE IF NOT EXISTS TestImages (
    image_id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,
    image_path TEXT NOT NULL,
    correct_path TEXT,
    difficulty INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
)
''')

# Create trigger for flight duration calculation
cursor.execute('''
CREATE TRIGGER IF NOT EXISTS CalculateFlightDuration 
AFTER INSERT ON Flights
BEGIN
    UPDATE Flights 
    SET duration = CAST(
        (strftime('%s', arrival_time) - strftime('%s', departure_time)) / 60 
        AS INTEGER)
    WHERE flight_id = NEW.flight_id;
END;
''')

# Save changes and close connection
conn.commit()
conn.close()

print("Database schema successfully initialized!")
