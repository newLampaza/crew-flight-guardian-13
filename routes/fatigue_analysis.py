
import os
from flask import Blueprint, request, jsonify
from werkzeug.utils import secure_filename
import uuid
import json
from datetime import datetime
import sqlite3
import sys

# Add the neural_network directory to the Python path
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'neural_network'))
from predict import FatigueAnalyzer

# Create a blueprint for fatigue analysis routes
fatigue_bp = Blueprint('fatigue', __name__)

# Path to the model and storage directories
MODEL_PATH = os.path.join('neural_network', 'data', 'models', 'fatigue_model.keras')
UPLOAD_FOLDER = os.path.join('neural_network', 'data', 'uploads')
VIDEO_FOLDER = os.path.join('neural_network', 'data', 'video')

# Ensure the upload folders exist
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(VIDEO_FOLDER, exist_ok=True)

# Get database connection
def get_db_connection():
    conn = sqlite3.connect('database/database.db')
    conn.row_factory = sqlite3.Row
    return conn

# Allowed file extensions
ALLOWED_EXTENSIONS = {'webm', 'mp4', 'avi', 'mov'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@fatigue_bp.route('/api/flights/last', methods=['GET'])
def get_last_flight():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Get the most recent flight with video recording
        cursor.execute('''
            SELECT flight_id, from_code, to_code, departure_time, arrival_time, video_path, status 
            FROM flights 
            WHERE video_path IS NOT NULL 
            ORDER BY departure_time DESC 
            LIMIT 1
        ''')
        
        flight = cursor.fetchone()
        conn.close()
        
        if flight:
            return jsonify({
                'success': True,
                'data': dict(flight)
            })
        else:
            return jsonify({
                'success': True,
                'data': None,
                'message': 'No flights with video recordings found'
            })
            
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@fatigue_bp.route('/api/fatigue/analyze', methods=['POST'])
def analyze_video():
    # Check if the post request has the file part
    if 'video' not in request.files:
        return jsonify({
            'success': False,
            'error': 'No video file provided'
        }), 400
        
    file = request.files['video']
    
    # If user does not select file, browser also submits an empty part without filename
    if file.filename == '':
        return jsonify({
            'success': False,
            'error': 'No video file selected'
        }), 400
        
    if file and allowed_file(file.filename):
        # Generate unique filename
        filename = secure_filename(str(uuid.uuid4()) + os.path.splitext(file.filename)[1])
        file_path = os.path.join(UPLOAD_FOLDER, filename)
        file.save(file_path)
        
        try:
            # Initialize the FatigueAnalyzer
            analyzer = FatigueAnalyzer(MODEL_PATH)
            
            # Process the video file
            # In a production environment, this would be handled by a background task
            # For simplicity, we're processing it synchronously here
            level, percent = analyzer.analyze_source(file_path, is_video_file=True)
            
            # Save results to database
            conn = get_db_connection()
            cursor = conn.cursor()
            
            cursor.execute('''
                INSERT INTO fatigue_analysis 
                (video_path, fatigue_level, neural_network_score, analysis_date) 
                VALUES (?, ?, ?, ?)
            ''', (filename, level, percent/100, datetime.now().isoformat()))
            
            analysis_id = cursor.lastrowid
            conn.commit()
            conn.close()
            
            # Return the analysis results
            return jsonify({
                'success': True,
                'data': {
                    'analysis_id': analysis_id,
                    'fatigue_level': level,
                    'neural_network_score': percent/100,
                    'analysis_date': datetime.now().isoformat(),
                    'video_path': f"/uploads/{filename}"
                }
            })
            
        except Exception as e:
            return jsonify({
                'success': False,
                'error': f"Error during analysis: {str(e)}"
            }), 500
            
    return jsonify({
        'success': False,
        'error': 'Invalid file format'
    }), 400

@fatigue_bp.route('/api/fatigue/save-recording', methods=['POST'])
def save_recording():
    if 'video' not in request.files:
        return jsonify({
            'success': False,
            'error': 'No video file provided'
        }), 400
        
    file = request.files['video']
    
    if file.filename == '':
        return jsonify({
            'success': False,
            'error': 'No video file selected'
        }), 400
        
    if file and allowed_file(file.filename):
        filename = secure_filename(str(uuid.uuid4()) + os.path.splitext(file.filename)[1])
        file_path = os.path.join(VIDEO_FOLDER, filename)
        file.save(file_path)
        
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            
            cursor.execute('''
                INSERT INTO recordings (video_path, recording_date) 
                VALUES (?, ?)
            ''', (filename, datetime.now().isoformat()))
            
            recording_id = cursor.lastrowid
            conn.commit()
            conn.close()
            
            return jsonify({
                'success': True,
                'data': {
                    'recording_id': recording_id,
                    'video_path': f"/videos/{filename}",
                    'recording_date': datetime.now().isoformat()
                }
            })
            
        except Exception as e:
            return jsonify({
                'success': False,
                'error': f"Error saving recording: {str(e)}"
            }), 500
            
    return jsonify({
        'success': False,
        'error': 'Invalid file format'
    }), 400

@fatigue_bp.route('/api/fatigue-analysis/start', methods=['POST'])
def start_analysis():
    data = request.get_json()
    
    if not data or 'flight_id' not in data:
        return jsonify({
            'success': False,
            'error': 'Flight ID is required'
        }), 400
        
    flight_id = data['flight_id']
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Get flight information
        cursor.execute('SELECT * FROM flights WHERE flight_id = ?', (flight_id,))
        flight = cursor.fetchone()
        
        if not flight:
            return jsonify({
                'success': False,
                'error': 'Flight not found'
            }), 404
            
        if not flight['video_path']:
            return jsonify({
                'success': False,
                'error': 'No video recording available for this flight'
            }), 400
            
        # Create analysis record
        cursor.execute('''
            INSERT INTO fatigue_analysis 
            (flight_id, analysis_date, status) 
            VALUES (?, ?, 'in_progress')
        ''', (flight_id, datetime.now().isoformat()))
        
        analysis_id = cursor.lastrowid
        conn.commit()
        
        # In a real application, we would start a background task here
        # For simplicity, we'll analyze synchronously
        video_path = os.path.join(VIDEO_FOLDER, flight['video_path'])
        
        analyzer = FatigueAnalyzer(MODEL_PATH)
        level, percent = analyzer.analyze_source(video_path, is_video_file=True)
        
        # Update the analysis record
        cursor.execute('''
            UPDATE fatigue_analysis 
            SET fatigue_level = ?, neural_network_score = ?, status = 'completed' 
            WHERE analysis_id = ?
        ''', (level, percent/100, analysis_id))
        
        conn.commit()
        conn.close()
        
        return jsonify({
            'success': True,
            'data': {
                'analysis_id': analysis_id,
                'status': 'completed'
            }
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f"Error starting analysis: {str(e)}"
        }), 500

@fatigue_bp.route('/api/fatigue-analysis/results/<int:analysis_id>', methods=['GET'])
def get_analysis_results(analysis_id):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Join with flights table to get flight information
        cursor.execute('''
            SELECT fa.*, f.from_code, f.to_code, f.departure_time, f.video_path
            FROM fatigue_analysis fa
            LEFT JOIN flights f ON fa.flight_id = f.flight_id
            WHERE fa.analysis_id = ?
        ''', (analysis_id,))
        
        result = cursor.fetchone()
        conn.close()
        
        if not result:
            return jsonify({
                'success': False,
                'error': 'Analysis not found'
            }), 404
            
        # Convert to dictionary
        analysis_data = dict(result)
        
        return jsonify({
            'success': True,
            'data': analysis_data
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f"Error retrieving analysis results: {str(e)}"
        }), 500

@fatigue_bp.route('/api/fatigue-analysis/history', methods=['GET'])
def get_analysis_history():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT fa.*, f.from_code, f.to_code
            FROM fatigue_analysis fa
            LEFT JOIN flights f ON fa.flight_id = f.flight_id
            ORDER BY fa.analysis_date DESC
            LIMIT 10
        ''')
        
        results = cursor.fetchall()
        conn.close()
        
        # Convert to list of dictionaries
        history = [dict(row) for row in results]
        
        return jsonify({
            'success': True,
            'data': history
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f"Error retrieving analysis history: {str(e)}"
        }), 500

@fatigue_bp.route('/api/fatigue-analysis/feedback', methods=['POST'])
def submit_feedback():
    data = request.get_json()
    
    if not data or 'analysis_id' not in data or 'rating' not in data:
        return jsonify({
            'success': False,
            'error': 'Analysis ID and rating are required'
        }), 400
        
    analysis_id = data['analysis_id']
    rating = data['rating']
    comments = data.get('comments', '')
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Update the feedback in the analysis record
        cursor.execute('''
            UPDATE fatigue_analysis 
            SET feedback_score = ?, feedback_comments = ? 
            WHERE analysis_id = ?
        ''', (rating, comments, analysis_id))
        
        if cursor.rowcount == 0:
            return jsonify({
                'success': False,
                'error': 'Analysis not found'
            }), 404
            
        conn.commit()
        conn.close()
        
        return jsonify({
            'success': True,
            'data': {
                'status': 'Feedback submitted successfully'
            }
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f"Error submitting feedback: {str(e)}"
        }), 500
