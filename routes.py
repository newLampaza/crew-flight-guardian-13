from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import sqlite3
from datetime import datetime, timedelta
import os
import json
import random
import uuid
from werkzeug.utils import secure_filename
import time

# Import our fatigue analysis routes
from routes.fatigue_analysis import fatigue_bp

# Initialize the Flask application
app = Flask(__name__, static_folder='dist', static_url_path='/')
CORS(app)

# Register the fatigue analysis blueprint
app.register_blueprint(fatigue_bp)

# Define upload folders
UPLOAD_FOLDER = os.path.join('neural_network', 'data', 'uploads')
VIDEO_FOLDER = os.path.join('neural_network', 'data', 'video')

# Ensure directories exist
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(VIDEO_FOLDER, exist_ok=True)

# Configure app settings
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # max 50MB

# Get database connection
def get_db_connection():
    conn = sqlite3.connect('database/database.db')
    conn.row_factory = sqlite3.Row
    return conn

# Ensure required database tables exist
def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Create flights table if it doesn't exist
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS flights (
        flight_id INTEGER PRIMARY KEY AUTOINCREMENT,
        from_code TEXT,
        to_code TEXT,
        departure_time TEXT,
        arrival_time TEXT,
        video_path TEXT,
        status TEXT
    )
    ''')
    
    # Create fatigue_analysis table if it doesn't exist
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS fatigue_analysis (
        analysis_id INTEGER PRIMARY KEY AUTOINCREMENT,
        flight_id INTEGER,
        video_path TEXT,
        fatigue_level TEXT,
        neural_network_score REAL,
        analysis_date TEXT,
        feedback_score INTEGER,
        feedback_comments TEXT,
        status TEXT,
        FOREIGN KEY (flight_id) REFERENCES flights (flight_id)
    )
    ''')
    
    # Create recordings table if it doesn't exist
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS recordings (
        recording_id INTEGER PRIMARY KEY AUTOINCREMENT,
        video_path TEXT,
        recording_date TEXT
    )
    ''')
    
    # Add test data if tables are empty
    cursor.execute('SELECT COUNT(*) FROM flights')
    if cursor.fetchone()[0] == 0:
        # Add some test flights
        test_flights = [
            ('SVO', 'LED', '2025-04-15T14:30:00', '2025-04-15T16:00:00', 'test.mp4', 'completed'),
            ('LED', 'SVO', '2025-04-16T10:00:00', '2025-04-16T11:30:00', 'test2.mp4', 'completed'),
            ('SVO', 'KZN', '2025-04-17T08:15:00', '2025-04-17T09:45:00', 'test3.mp4', 'completed')
        ]
        
        cursor.executemany('''
        INSERT INTO flights (from_code, to_code, departure_time, arrival_time, video_path, status)
        VALUES (?, ?, ?, ?, ?, ?)
        ''', test_flights)
    
    conn.commit()
    conn.close()

# Initialize database on startup
init_db()

# Serve static files from the frontend build
@app.route('/')
def index():
    return app.send_static_file('index.html')

# Serve uploaded files
@app.route('/uploads/<path:filename>')
def uploaded_file(filename):
    return send_from_directory(UPLOAD_FOLDER, filename)

# Serve video files
@app.route('/videos/<path:filename>')
def video_file(filename):
    return send_from_directory(VIDEO_FOLDER, filename)

# Authentication API
@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    
    if not data or 'username' not in data or 'password' not in data:
        return jsonify({'success': False, 'error': 'Username and password required'}), 400
        
    username = data['username']
    password = data['password']
    
    # For demo purposes, we'll accept any login with password "password"
    if password == 'password':
        return jsonify({
            'success': True,
            'data': {
                'token': str(uuid.uuid4()),
                'user': {
                    'id': 1,
                    'name': username,
                    'role': 'pilot'
                }
            }
        })
    else:
        return jsonify({'success': False, 'error': 'Invalid credentials'}), 401

# Add all other existing routes from your original routes.py file here
# ...

# Make the app run only when directly executed
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
