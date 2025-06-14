
import sqlite3
import os
from datetime import datetime

def init_db_v2():
    """Initialize database with improved schema v2"""
    # Database path setup
    db_path = os.path.join('database.db')

    # Connect to database
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Drop old unused tables first
    unused_tables = ['FatigueVideos', 'TestMistakes', 'TestSessions', 'TestImages']
    for table in unused_tables:
        cursor.execute(f'DROP TABLE IF EXISTS {table}')

    # Create tables with proper schemas and standardized datetime format

    # Users table with enhanced authentication fields
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS Users (
        user_id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id INTEGER UNIQUE NOT NULL,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        role TEXT CHECK(role IN ('pilot', 'admin', 'medical')) NOT NULL,
        last_login DATETIME,
        created_at DATETIME DEFAULT (datetime('now')),
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
        employment_date DATE,
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
        crew_id INTEGER NOT NULL,
        employee_id INTEGER NOT NULL,
        role TEXT NOT NULL,
        join_date DATETIME DEFAULT (datetime('now')),
        FOREIGN KEY (crew_id) REFERENCES Crews (crew_id),
        FOREIGN KEY (employee_id) REFERENCES Employees (employee_id),
        PRIMARY KEY (crew_id, employee_id)
    )
    ''')

    # Flights table with standardized datetime format
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS Flights (
        flight_id INTEGER PRIMARY KEY AUTOINCREMENT,
        crew_id INTEGER,
        flight_number TEXT,
        departure_time DATETIME NOT NULL,
        arrival_time DATETIME NOT NULL,
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

    # Fatigue Analysis table with proper datetime and constraints
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS FatigueAnalysis (
        analysis_id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id INTEGER NOT NULL,
        flight_id INTEGER,
        fatigue_level TEXT CHECK(fatigue_level IN ('Low', 'Medium', 'High', 'Unknown', 'Saved')),
        neural_network_score REAL CHECK(neural_network_score >= 0 AND neural_network_score <= 1),
        feedback_score INTEGER CHECK(feedback_score >= 1 AND feedback_score <= 5),
        analysis_date DATETIME NOT NULL DEFAULT (datetime('now')),
        video_path TEXT,
        notes TEXT,
        resolution TEXT,
        fps REAL,
        FOREIGN KEY (employee_id) REFERENCES Employees (employee_id),
        FOREIGN KEY (flight_id) REFERENCES Flights (flight_id)
    )
    ''')

    # Medical Checks table (kept for future use)
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS MedicalChecks (
        check_id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id INTEGER NOT NULL,
        check_date DATE NOT NULL,
        expiry_date DATE NOT NULL,
        status TEXT CHECK(status IN ('passed', 'conditionally_passed', 'failed')) NOT NULL,
        doctor_name TEXT,
        notes TEXT,
        FOREIGN KEY (employee_id) REFERENCES Employees (employee_id)
    )
    ''')

    # Cognitive Tests table with proper datetime
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS CognitiveTests (
        test_id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id INTEGER NOT NULL,
        test_date DATETIME NOT NULL DEFAULT (datetime('now')),
        test_type TEXT CHECK(test_type IN ('attention', 'memory', 'reaction', 'cognitive')) NOT NULL,
        score REAL NOT NULL CHECK(score >= 0 AND score <= 100),
        duration INTEGER NOT NULL,
        details TEXT,
        cooldown_end DATETIME,
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
        created_at DATETIME DEFAULT (datetime('now')),
        FOREIGN KEY (employee_id) REFERENCES Employees (employee_id)
    )
    ''')

    # Create trigger for flight duration calculation
    cursor.execute('''
    CREATE TRIGGER IF NOT EXISTS CalculateFlightDuration 
    AFTER INSERT ON Flights
    BEGIN
        UPDATE Flights 
        SET duration = CAST(
            (julianday(arrival_time) - julianday(departure_time)) * 24 * 60 
            AS INTEGER)
        WHERE flight_id = NEW.flight_id;
    END;
    ''')

    # Create indexes for better performance
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_flights_departure ON Flights(departure_time)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_fatigue_analysis_date ON FatigueAnalysis(analysis_date)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_cognitive_tests_date ON CognitiveTests(test_date)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_feedback_entity ON Feedback(entity_type, entity_id)')

    # Save changes and close connection
    conn.commit()
    conn.close()

    print("Database schema v2 successfully initialized!")

if __name__ == "__main__":
    init_db_v2()
