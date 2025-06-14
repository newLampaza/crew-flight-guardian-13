
import sqlite3
import os
import shutil
from datetime import datetime

def parse_datetime(dt_string):
    """Parse various datetime formats to ISO format"""
    if not dt_string:
        return None
    
    # Remove any timezone info and normalize
    dt_string = str(dt_string).strip()
    
    # Handle different formats
    formats = [
        '%Y-%m-%dT%H:%M:%S',  # ISO format
        '%Y-%m-%d %H:%M:%S',  # Standard format
        '%Y-%m-%d',           # Date only
    ]
    
    for fmt in formats:
        try:
            parsed = datetime.strptime(dt_string, fmt)
            return parsed.strftime('%Y-%m-%dT%H:%M:%S')
        except ValueError:
            continue
    
    # If all parsing fails, return current time
    print(f"Warning: Could not parse datetime '{dt_string}', using current time")
    return datetime.now().strftime('%Y-%m-%dT%H:%M:%S')

def migrate_v1_to_v2():
    """Migrate database from v1 to v2 schema"""
    db_path = os.path.join('database', 'database.db')
    backup_path = os.path.join('database', 'database_v1_backup.db')
    
    if not os.path.exists(db_path):
        print("No database found to migrate")
        return
    
    # Create backup
    shutil.copy2(db_path, backup_path)
    print(f"Created backup at {backup_path}")
    
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    try:
        # Get existing data before schema changes
        print("Extracting existing data...")
        
        # Extract Users data
        users_data = []
        try:
            users = cursor.execute('SELECT * FROM Users').fetchall()
            users_data = [dict(row) for row in users]
        except:
            print("No Users table found")
        
        # Extract Employees data
        employees_data = []
        try:
            employees = cursor.execute('SELECT * FROM Employees').fetchall()
            employees_data = [dict(row) for row in employees]
        except:
            print("No Employees table found")
        
        # Extract Crews data
        crews_data = []
        try:
            crews = cursor.execute('SELECT * FROM Crews').fetchall()
            crews_data = [dict(row) for row in crews]
        except:
            print("No Crews table found")
        
        # Extract CrewMembers data
        crew_members_data = []
        try:
            crew_members = cursor.execute('SELECT * FROM CrewMembers').fetchall()
            crew_members_data = [dict(row) for row in crew_members]
        except:
            print("No CrewMembers table found")
        
        # Extract Flights data
        flights_data = []
        try:
            flights = cursor.execute('SELECT * FROM Flights').fetchall()
            flights_data = [dict(row) for row in flights]
        except:
            print("No Flights table found")
        
        # Extract FatigueAnalysis data
        fatigue_data = []
        try:
            fatigue = cursor.execute('SELECT * FROM FatigueAnalysis').fetchall()
            fatigue_data = [dict(row) for row in fatigue]
        except:
            print("No FatigueAnalysis table found")
        
        # Extract CognitiveTests data
        cognitive_data = []
        try:
            cognitive = cursor.execute('SELECT * FROM CognitiveTests').fetchall()
            cognitive_data = [dict(row) for row in cognitive]
        except:
            print("No CognitiveTests table found")
        
        # Extract Feedback data
        feedback_data = []
        try:
            feedback = cursor.execute('SELECT * FROM Feedback').fetchall()
            feedback_data = [dict(row) for row in feedback]
        except:
            print("No Feedback table found")
        
        # Extract MedicalChecks data
        medical_data = []
        try:
            medical = cursor.execute('SELECT * FROM MedicalChecks').fetchall()
            medical_data = [dict(row) for row in medical]
        except:
            print("No MedicalChecks table found")
        
        # Drop all existing tables
        print("Dropping old tables...")
        tables_to_drop = [
            'TestMistakes', 'CognitiveTests', 'MedicalChecks', 
            'FatigueAnalysis', 'CrewMembers', 'Flights', 'Crews',
            'Users', 'Employees', 'FatigueVideos', 'TestSessions', 'TestImages'
        ]
        
        for table in tables_to_drop:
            try:
                cursor.execute(f'DROP TABLE IF EXISTS {table}')
            except:
                pass
        
        conn.commit()
        
        # Initialize new schema
        print("Creating new schema...")
        from schema_v2 import init_db_v2
        init_db_v2()
        
        # Reconnect with new schema
        conn.close()
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Migrate data with proper datetime formatting
        print("Migrating data...")
        
        # Migrate Employees
        for emp in employees_data:
            employment_date = emp.get('employment_date')
            if employment_date:
                # For employment_date, we want just the date part
                try:
                    parsed_date = datetime.strptime(employment_date, '%Y-%m-%d').strftime('%Y-%m-%d')
                except:
                    parsed_date = datetime.now().strftime('%Y-%m-%d')
            else:
                parsed_date = None
                
            cursor.execute('''
                INSERT INTO Employees (employee_id, name, role, position, contact_info, employment_date, image_url, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                emp.get('employee_id'),
                emp.get('name'),
                emp.get('role'),
                emp.get('position'),
                emp.get('contact_info'),
                parsed_date,
                emp.get('image_url'),
                emp.get('status', 'active')
            ))
        
        # Migrate Users
        for user in users_data:
            last_login = parse_datetime(user.get('last_login')) if user.get('last_login') else None
            created_at = parse_datetime(user.get('created_at')) if user.get('created_at') else datetime.now().strftime('%Y-%m-%dT%H:%M:%S')
            
            cursor.execute('''
                INSERT INTO Users (user_id, employee_id, username, password, role, last_login, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (
                user.get('user_id'),
                user.get('employee_id'),
                user.get('username'),
                user.get('password'),
                user.get('role'),
                last_login,
                created_at
            ))
        
        # Migrate Crews
        for crew in crews_data:
            cursor.execute('''
                INSERT INTO Crews (crew_id, crew_name, status)
                VALUES (?, ?, ?)
            ''', (
                crew.get('crew_id'),
                crew.get('crew_name'),
                crew.get('status', 'active')
            ))
        
        # Migrate CrewMembers
        for cm in crew_members_data:
            join_date = parse_datetime(cm.get('join_date')) if cm.get('join_date') else datetime.now().strftime('%Y-%m-%dT%H:%M:%S')
            
            cursor.execute('''
                INSERT INTO CrewMembers (crew_id, employee_id, role, join_date)
                VALUES (?, ?, ?, ?)
            ''', (
                cm.get('crew_id'),
                cm.get('employee_id'),
                cm.get('role'),
                join_date
            ))
        
        # Migrate Flights
        for flight in flights_data:
            departure_time = parse_datetime(flight.get('departure_time'))
            arrival_time = parse_datetime(flight.get('arrival_time'))
            
            cursor.execute('''
                INSERT INTO Flights (flight_id, crew_id, flight_number, departure_time, arrival_time, 
                                   duration, from_code, from_city, to_code, to_city, aircraft, 
                                   conditions, status, video_path)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                flight.get('flight_id'),
                flight.get('crew_id'),
                flight.get('flight_number'),
                departure_time,
                arrival_time,
                flight.get('duration'),
                flight.get('from_code'),
                flight.get('from_city'),
                flight.get('to_code'),
                flight.get('to_city'),
                flight.get('aircraft'),
                flight.get('conditions'),
                flight.get('status', 'scheduled'),
                flight.get('video_path')
            ))
        
        # Migrate FatigueAnalysis
        for fa in fatigue_data:
            analysis_date = parse_datetime(fa.get('analysis_date')) if fa.get('analysis_date') else datetime.now().strftime('%Y-%m-%dT%H:%M:%S')
            
            cursor.execute('''
                INSERT INTO FatigueAnalysis (analysis_id, employee_id, flight_id, fatigue_level, 
                                           neural_network_score, feedback_score, analysis_date, 
                                           video_path, notes, resolution, fps)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                fa.get('analysis_id'),
                fa.get('employee_id'),
                fa.get('flight_id'),
                fa.get('fatigue_level'),
                fa.get('neural_network_score'),
                fa.get('feedback_score'),
                analysis_date,
                fa.get('video_path'),
                fa.get('notes'),
                fa.get('resolution'),
                fa.get('fps')
            ))
        
        # Migrate CognitiveTests
        for ct in cognitive_data:
            test_date = parse_datetime(ct.get('test_date')) if ct.get('test_date') else datetime.now().strftime('%Y-%m-%dT%H:%M:%S')
            cooldown_end = parse_datetime(ct.get('cooldown_end')) if ct.get('cooldown_end') else None
            
            cursor.execute('''
                INSERT INTO CognitiveTests (test_id, employee_id, test_date, test_type, score, 
                                          duration, details, cooldown_end)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                ct.get('test_id'),
                ct.get('employee_id'),
                test_date,
                ct.get('test_type'),
                ct.get('score'),
                ct.get('duration'),
                ct.get('details'),
                cooldown_end
            ))
        
        # Migrate Feedback
        for fb in feedback_data:
            created_at = parse_datetime(fb.get('created_at')) if fb.get('created_at') else datetime.now().strftime('%Y-%m-%dT%H:%M:%S')
            
            cursor.execute('''
                INSERT INTO Feedback (feedback_id, employee_id, entity_type, entity_id, rating, comments, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (
                fb.get('feedback_id'),
                fb.get('employee_id'),
                fb.get('entity_type'),
                fb.get('entity_id'),
                fb.get('rating'),
                fb.get('comments'),
                created_at
            ))
        
        # Migrate MedicalChecks
        for mc in medical_data:
            check_date = mc.get('check_date')
            expiry_date = mc.get('expiry_date')
            
            # For medical checks, we want date format
            if check_date:
                try:
                    check_date = datetime.strptime(check_date, '%Y-%m-%d').strftime('%Y-%m-%d')
                except:
                    check_date = datetime.now().strftime('%Y-%m-%d')
            
            if expiry_date:
                try:
                    expiry_date = datetime.strptime(expiry_date, '%Y-%m-%d').strftime('%Y-%m-%d')
                except:
                    expiry_date = datetime.now().strftime('%Y-%m-%d')
            
            cursor.execute('''
                INSERT INTO MedicalChecks (check_id, employee_id, check_date, expiry_date, status, doctor_name, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (
                mc.get('check_id'),
                mc.get('employee_id'),
                check_date,
                expiry_date,
                mc.get('status'),
                mc.get('doctor_name'),
                mc.get('notes')
            ))
        
        conn.commit()
        print("Migration completed successfully!")
        
    except Exception as e:
        print(f"Migration failed: {e}")
        import traceback
        traceback.print_exc()
        # Restore backup
        conn.close()
        shutil.copy2(backup_path, db_path)
        print("Database restored from backup")
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    migrate_v1_to_v2()
