

import os
import uuid
import traceback
import logging
from flask import Blueprint, request, jsonify, current_app
import sqlite3
import cv2
import subprocess
from datetime import datetime
from neural_network.predict import analyze_source
from blueprints.auth import token_required

# Setup logging for errors only
fatigue_logger = logging.getLogger('fatigue_analysis')
fatigue_logger.setLevel(logging.ERROR)

# Create file handler for fatigue analysis logs (errors only)
if not fatigue_logger.handlers:
    fh = logging.FileHandler('fatigue_analysis.log', encoding='utf-8')
    fh.setLevel(logging.ERROR)
    formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    fh.setFormatter(formatter)
    fatigue_logger.addHandler(fh)

fatigue_bp = Blueprint('fatigue', __name__, url_prefix='/api/fatigue')
logger = logging.getLogger(__name__)

# Ensure video directory exists
VIDEO_DIR = os.path.join('neural_network', 'data', 'video')
os.makedirs(VIDEO_DIR, exist_ok=True)
ALLOWED_EXTENSIONS = {'mp4', 'avi', 'mov', 'webm', 'mkv'}

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def get_video_file_path(filename):
    """Find video file path by filename only"""
    # Remove any path prefixes and use only the filename
    if filename.startswith('/videos/'):
        filename = filename[8:]  # Remove '/videos/' prefix
    elif filename.startswith('/video/'):
        filename = filename[7:]  # Remove '/video/' prefix
    
    # Check if file exists in video directory
    full_path = os.path.join(VIDEO_DIR, filename)
    if os.path.exists(full_path):
        return full_path
    
    # If not found, search recursively
    for root, dirs, files in os.walk(VIDEO_DIR):
        if filename in files:
            return os.path.join(root, filename)
    
    return None

@fatigue_bp.route('/analyze', methods=['POST'])
@token_required
def analyze_fatigue(current_user):
    request_id = str(uuid.uuid4())[:8]
    
    conn = None
    try:
        if 'video' not in request.files:
            return jsonify({'error': 'No video file provided'}), 400
            
        video_file = request.files['video']
        if not video_file or video_file.filename == '':
            return jsonify({'error': 'Invalid video file'}), 400

        # Get file extension and generate unique names
        file_ext = video_file.filename.split('.')[-1].lower()
        if not allowed_file(video_file.filename):
            return jsonify({'error': f'Unsupported format. Allowed: {ALLOWED_EXTENSIONS}'}), 400

        # Generate filenames (store only filename, not full path)
        unique_id = uuid.uuid4()
        original_name = f"video_{unique_id}.{file_ext}"
        original_path = os.path.join(VIDEO_DIR, original_name)
        output_name = f"analyzed_{unique_id}.mp4"
        output_path = os.path.join(VIDEO_DIR, output_name)

        try:
            # Save original video
            video_file.save(original_path)

            # Check file size after saving
            file_size = os.path.getsize(original_path)

            if file_size == 0:
                os.remove(original_path)
                return jsonify({'error': 'Uploaded video file is empty'}), 400

            # Analyze the video and save output with visualization
            level, percent, details = analyze_source(
                source=original_path, 
                is_video_file=True,
                output_file=output_path
            )
            
            # Check if a face was detected
            face_detected = details.get('face_detected_ratio', 0) > 0
            error_msg = details.get('error')
            
            if not face_detected or error_msg:
                os.remove(original_path)
                if os.path.exists(output_path):
                    os.remove(output_path)
                    
                return jsonify({
                    'error': error_msg or 'No face detected in the video',
                    'face_detected': face_detected,
                    'details': details
                }), 400

            # Verify output file was created
            if not os.path.exists(output_path):
                return jsonify({'error': 'Failed to create analyzed video'}), 500

            # Save analysis to database
            conn = sqlite3.connect('database/database.db')
            conn.row_factory = sqlite3.Row
            
            # Get current flight information
            flight = conn.execute('''
                SELECT flight_id FROM Flights 
                WHERE crew_id = (
                    SELECT crew_id FROM CrewMembers 
                    WHERE employee_id = ?
                )
                ORDER BY arrival_time DESC 
                LIMIT 1
            ''', (current_user['employee_id'],)).fetchone()
            
            flight_id = flight['flight_id'] if flight else None
            
            # Store the analysis (save only filename, not full path)
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO FatigueAnalysis 
                (employee_id, flight_id, fatigue_level, 
                neural_network_score, analysis_date, video_path)
                VALUES (?, ?, ?, ?, datetime('now', 'localtime'), ?)
            ''', (
                current_user['employee_id'],
                flight_id,
                level,
                percent/100 if percent else 0,
                output_name  # Store only filename
            ))
            conn.commit()
            analysis_id = cursor.lastrowid
            
            # Clean up original file (keep only processed version)
            os.remove(original_path)
            
            # Return the result with video path
            result = {
                'status': 'success',
                'analysis_id': analysis_id,
                'fatigue_level': level,
                'neural_network_score': percent / 100 if percent else 0,
                'video_path': output_name,  # Return only filename
                'resolution': details.get('resolution', 'unknown'),
                'fps': details.get('fps', 0),
                'face_detection_ratio': details.get('face_detected_ratio', 0),
                'frames_analyzed': details.get('frames_analyzed', 0)
            }
            
            return jsonify(result), 201

        except Exception as e:
            error_type = ""
            user_msg = "Video processing error"
            technical_msg = str(e)
            
            fatigue_logger.error(f"[{request_id}] Processing error: {technical_msg}")
            
            # Clean up any files
            if os.path.exists(original_path):
                os.remove(original_path)
            if os.path.exists(output_path):
                os.remove(output_path)
                
            if "no face" in technical_msg.lower() or "face not detected" in technical_msg.lower():
                user_msg = "No face detected in the video"
                error_type = "face_detection_error"
                
            return jsonify({
                'error': user_msg,
                'technical_details': technical_msg,
                'error_type': error_type
            }), 400

    except Exception as e:
        fatigue_logger.error(f"[{request_id}] Critical error: {traceback.format_exc()}")
        return jsonify({
            'error': 'Internal server error',
            'details': str(e)
        }), 500
    finally:
        if conn:
            conn.close()

@fatigue_bp.route('/analyze-flight', methods=['POST'])
@token_required
def analyze_flight(current_user):
    request_id = str(uuid.uuid4())[:8]
    
    conn = None
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400

        flight_id = data.get('flight_id')
        video_path = data.get('video_path')
        
        if not flight_id or not video_path:
            return jsonify({'error': 'flight_id and video_path are required'}), 400

        conn = sqlite3.connect('database/database.db')
        conn.row_factory = sqlite3.Row
        
        # Get flight information
        flight = conn.execute('''
            SELECT f.flight_id, f.from_code, f.to_code, f.video_path, f.arrival_time
            FROM Flights f
            JOIN CrewMembers cm ON f.crew_id = cm.crew_id
            WHERE cm.employee_id = ?
                AND f.flight_id = ?
        ''', (current_user['employee_id'], flight_id)).fetchone()

        if not flight:
            return jsonify({'error': 'Flight not found'}), 404

        # Get video file path using standardized function
        full_video_path = get_video_file_path(video_path)
        
        if not full_video_path or not os.path.exists(full_video_path):
            return jsonify({'error': f'Video file not found: {video_path}'}), 404

        # Generate output filename
        output_name = f"analyzed_flight_{uuid.uuid4()}.mp4"
        output_path = os.path.join(VIDEO_DIR, output_name)
        
        # Analyze the flight video
        level, percent, details = analyze_source(
            source=full_video_path, 
            is_video_file=True,
            output_file=output_path
        )
        
        # Check if face was detected
        if details.get('error'):
            return jsonify({
                'error': details.get('error'),
                'details': details
            }), 400

        # Save results
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO FatigueAnalysis 
            (employee_id, flight_id, fatigue_level, 
             neural_network_score, analysis_date, video_path)
            VALUES (?, ?, ?, ?, datetime('now', 'localtime'), ?)
        ''', (
            current_user['employee_id'],
            flight['flight_id'],
            level,
            percent/100 if percent else 0,
            output_name  # Store only filename
        ))
        analysis_id = cursor.lastrowid
        conn.commit()

        # Return complete analysis data
        result = {
            'analysis_id': analysis_id,
            'fatigue_level': level,
            'neural_network_score': percent/100 if percent else 0,
            'video_path': output_name,  # Return only filename
            'from_code': flight['from_code'],
            'to_code': flight['to_code'],
            'resolution': details.get('resolution', 'unknown'),
            'fps': details.get('fps', 0),
            'face_detection_ratio': details.get('face_detected_ratio', 0),
            'frames_analyzed': details.get('frames_analyzed', 0)
        }
        
        return jsonify(result)

    except Exception as e:
        fatigue_logger.error(f"[{request_id}] Flight analysis error: {traceback.format_exc()}")
        return jsonify({'error': str(e)}), 500
    finally:
        if conn:
            conn.close()

# ... keep existing code (feedback, history, and get_analysis functions)

@fatigue_bp.route('/feedback', methods=['POST'])
@token_required
def submit_fatigue_feedback(current_user):
    conn = None
    try:
        data = request.get_json()
        
        if not data or 'analysis_id' not in data or 'score' not in data:
            return jsonify({'error': 'Missing required fields'}), 400
            
        try:
            analysis_id = int(data['analysis_id'])
            score = float(data['score'])
            if not (1 <= score <= 5):
                return jsonify({'error': 'Score must be between 1 and 5'}), 400
        except ValueError:
            return jsonify({'error': 'Invalid data types'}), 400
            
        conn = sqlite3.connect('database/database.db')
        conn.row_factory = sqlite3.Row
        
        # Verify analysis belongs to user
        analysis = conn.execute(
            'SELECT * FROM FatigueAnalysis WHERE analysis_id = ? AND employee_id = ?',
            (analysis_id, current_user['employee_id'])
        ).fetchone()
        
        if not analysis:
            return jsonify({'error': 'Analysis not found'}), 404
            
        # Update feedback score
        conn.execute(
            'UPDATE FatigueAnalysis SET feedback_score = ? WHERE analysis_id = ?',
            (score, analysis_id)
        )
        conn.commit()
        
        return jsonify({
            'status': 'success',
            'updated_id': analysis_id,
            'new_score': score
        })
        
    except Exception as e:
        logger.error(f"Feedback error: {str(e)}")
        return jsonify({'error': str(e)}), 500
    finally:
        if conn:
            conn.close()

@fatigue_bp.route('/history', methods=['GET'])
@token_required
def get_fatigue_history(current_user):
    conn = None
    try:
        conn = sqlite3.connect('database/database.db')
        conn.row_factory = sqlite3.Row
        
        history = conn.execute('''
            SELECT 
                fa.analysis_id,
                fa.analysis_date,
                fa.fatigue_level,
                fa.neural_network_score,
                fa.feedback_score,
                fa.video_path,
                f.from_code,
                f.to_code,
                f.departure_time
            FROM FatigueAnalysis fa
            LEFT JOIN Flights f ON fa.flight_id = f.flight_id
            WHERE fa.employee_id = ?
            ORDER BY fa.analysis_date DESC
        ''', (current_user['employee_id'],)).fetchall()
        
        return jsonify([dict(row) for row in history])
        
    except Exception as e:
        logger.error(f"Error getting history: {str(e)}")
        return jsonify({'error': str(e)}), 500
    finally:
        if conn:
            conn.close()

@fatigue_bp.route('/<int:analysis_id>', methods=['GET'])
@token_required
def get_analysis(current_user, analysis_id):
    conn = None
    try:
        conn = sqlite3.connect('database/database.db')
        conn.row_factory = sqlite3.Row
        
        analysis = conn.execute('''
            SELECT * FROM FatigueAnalysis 
            WHERE analysis_id = ?
            AND employee_id = ?
        ''', (analysis_id, current_user['employee_id'])).fetchone()
        
        if not analysis:
            return jsonify({'error': 'Analysis not found'}), 404
            
        return jsonify(dict(analysis))
        
    except Exception as e:
        logger.error(f"Error getting analysis: {str(e)}")
        return jsonify({'error': str(e)}), 500
    finally:
        if conn:
            conn.close()
