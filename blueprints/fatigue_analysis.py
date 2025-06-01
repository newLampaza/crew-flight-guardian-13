
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

# Configure detailed logging for fatigue analysis
fatigue_logger = logging.getLogger('fatigue_analysis')
fatigue_logger.setLevel(logging.INFO)

# Create file handler for fatigue analysis logs
if not fatigue_logger.handlers:
    fh = logging.FileHandler('fatigue_analysis.log', encoding='utf-8')
    fh.setLevel(logging.INFO)
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

@fatigue_bp.route('/analyze', methods=['POST'])
@token_required
def analyze_fatigue(current_user):
    request_id = str(uuid.uuid4())[:8]
    fatigue_logger.info(f"[{request_id}] Starting fatigue analysis for user {current_user['employee_id']}")
    
    conn = None
    try:
        if 'video' not in request.files:
            fatigue_logger.warning(f"[{request_id}] No video file in request")
            return jsonify({'error': 'No video file provided'}), 400
            
        video_file = request.files['video']
        if not video_file or video_file.filename == '':
            fatigue_logger.warning(f"[{request_id}] Invalid video file: {video_file}")
            return jsonify({'error': 'Invalid video file'}), 400

        fatigue_logger.info(f"[{request_id}] Received video file: {video_file.filename}, size: {video_file.content_length} bytes")

        # Get file extension and generate unique names
        file_ext = video_file.filename.split('.')[-1].lower()
        if not allowed_file(video_file.filename):
            fatigue_logger.error(f"[{request_id}] Unsupported file format: {file_ext}")
            return jsonify({'error': f'Unsupported format. Allowed: {ALLOWED_EXTENSIONS}'}), 400

        # Generate filenames
        unique_id = uuid.uuid4()
        original_name = f"video_{unique_id}.{file_ext}"
        original_path = os.path.join(VIDEO_DIR, original_name)
        output_name = f"analyzed_{unique_id}.mp4"
        output_path = os.path.join(VIDEO_DIR, output_name)

        fatigue_logger.info(f"[{request_id}] Generated paths - Original: {original_path}, Output: {output_path}")

        try:
            # Save original video
            video_file.save(original_path)
            fatigue_logger.info(f"[{request_id}] Video saved successfully: {original_path}")

            # Check file size after saving
            file_size = os.path.getsize(original_path)
            fatigue_logger.info(f"[{request_id}] Saved file size: {file_size} bytes")

            if file_size == 0:
                fatigue_logger.error(f"[{request_id}] Saved file is empty")
                os.remove(original_path)
                return jsonify({'error': 'Uploaded video file is empty'}), 400

            # Analyze the video and save output with visualization
            fatigue_logger.info(f"[{request_id}] Starting neural network analysis")
            level, percent, details = analyze_source(
                source=original_path, 
                is_video_file=True,
                output_file=output_path
            )
            
            fatigue_logger.info(f"[{request_id}] Analysis completed - Level: {level}, Percent: {percent}")
            fatigue_logger.info(f"[{request_id}] Analysis details: {details}")
            
            # Check if a face was detected
            face_detected = details.get('face_detected_ratio', 0) > 0
            error_msg = details.get('error')
            
            if not face_detected or error_msg:
                fatigue_logger.warning(f"[{request_id}] No face detected or error occurred: {error_msg}")
                # If no face was detected, return an error
                os.remove(original_path)  # Clean up original file
                if os.path.exists(output_path):
                    os.remove(output_path)  # Clean up output file
                    
                return jsonify({
                    'error': error_msg or 'No face detected in the video',
                    'face_detected': face_detected,
                    'details': details
                }), 400

            # Verify output file was created
            if not os.path.exists(output_path):
                fatigue_logger.error(f"[{request_id}] Output video was not created: {output_path}")
                return jsonify({'error': 'Failed to create analyzed video'}), 500

            output_size = os.path.getsize(output_path)
            fatigue_logger.info(f"[{request_id}] Output video created successfully, size: {output_size} bytes")

            # Save analysis to database
            fatigue_logger.info(f"[{request_id}] Saving analysis to database")
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
            fatigue_logger.info(f"[{request_id}] Associated flight ID: {flight_id}")
            
            # Store the analysis
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
                output_name
            ))
            conn.commit()
            analysis_id = cursor.lastrowid
            
            fatigue_logger.info(f"[{request_id}] Analysis saved to database with ID: {analysis_id}")
            
            # Clean up original file (keep only processed version)
            os.remove(original_path)
            fatigue_logger.info(f"[{request_id}] Cleaned up original file: {original_path}")
            
            # Return the result with video path
            result = {
                'status': 'success',
                'analysis_id': analysis_id,
                'fatigue_level': level,
                'neural_network_score': percent / 100 if percent else 0,
                'video_path': output_name,
                'resolution': details.get('resolution', 'unknown'),
                'fps': details.get('fps', 0),
                'face_detection_ratio': details.get('face_detected_ratio', 0),
                'frames_analyzed': details.get('frames_analyzed', 0)
            }
            
            fatigue_logger.info(f"[{request_id}] Analysis completed successfully: {result}")
            return jsonify(result), 201

        except Exception as e:
            error_type = ""
            user_msg = "Video processing error"
            technical_msg = str(e)
            
            fatigue_logger.error(f"[{request_id}] Processing error: {technical_msg}")
            fatigue_logger.error(f"[{request_id}] Full traceback: {traceback.format_exc()}")
            
            # Clean up any files
            if os.path.exists(original_path):
                os.remove(original_path)
                fatigue_logger.info(f"[{request_id}] Cleaned up original file after error")
            if os.path.exists(output_path):
                os.remove(output_path)
                fatigue_logger.info(f"[{request_id}] Cleaned up output file after error")
                
            if "no face" in technical_msg.lower() or "face not detected" in technical_msg.lower():
                user_msg = "No face detected in the video"
                error_type = "face_detection_error"
                fatigue_logger.warning(f"[{request_id}] Face detection error: {technical_msg}")
                
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

# ... keep existing code (other endpoints remain the same)

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

@fatigue_bp.route('/analyze-flight', methods=['POST'])
@token_required
def analyze_flight(current_user):
    request_id = str(uuid.uuid4())[:8]
    fatigue_logger.info(f"[{request_id}] Starting flight analysis for user {current_user['employee_id']}")
    
    conn = None
    try:
        conn = sqlite3.connect('database/database.db')
        conn.row_factory = sqlite3.Row
        
        # Get the last flight with video
        flight = conn.execute('''
            SELECT f.flight_id, f.video_path, f.from_code, f.to_code
            FROM Flights f
            JOIN CrewMembers cm ON f.crew_id = cm.crew_id
            WHERE cm.employee_id = ?
                AND f.arrival_time < datetime('now', 'localtime')
                AND f.video_path IS NOT NULL
            ORDER BY f.arrival_time DESC
            LIMIT 1
        ''', (current_user['employee_id'],)).fetchone()

        if not flight:
            fatigue_logger.warning(f"[{request_id}] No flights with video found for user")
            return jsonify({'error': 'No completed flights with video found'}), 404

        fatigue_logger.info(f"[{request_id}] Found flight: {flight['flight_id']}, video: {flight['video_path']}")

        video_path = os.path.join(VIDEO_DIR, flight['video_path'])
        
        if not os.path.exists(video_path):
            fatigue_logger.error(f"[{request_id}] Video file not found: {video_path}")
            return jsonify({'error': 'Video file not found'}), 404

        # Generate output filename
        output_name = f"analyzed_flight_{uuid.uuid4()}.mp4"
        output_path = os.path.join(VIDEO_DIR, output_name)

        fatigue_logger.info(f"[{request_id}] Starting flight video analysis")
        
        # Analyze the flight video
        level, percent, details = analyze_source(
            source=video_path, 
            is_video_file=True,
            output_file=output_path
        )
        
        fatigue_logger.info(f"[{request_id}] Flight analysis completed - Level: {level}, Percent: {percent}")
        
        # Check if face was detected
        if details.get('error'):
            fatigue_logger.warning(f"[{request_id}] Flight analysis error: {details.get('error')}")
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
            output_name
        ))
        analysis_id = cursor.lastrowid
        conn.commit()

        fatigue_logger.info(f"[{request_id}] Flight analysis saved to database with ID: {analysis_id}")

        # Return complete analysis data
        result = {
            'analysis_id': analysis_id,
            'fatigue_level': level,
            'neural_network_score': percent/100 if percent else 0,
            'video_path': output_name,
            'from_code': flight['from_code'],
            'to_code': flight['to_code'],
            'resolution': details.get('resolution', 'unknown'),
            'fps': details.get('fps', 0)
        }
        
        fatigue_logger.info(f"[{request_id}] Flight analysis completed successfully: {result}")
        return jsonify(result)

    except Exception as e:
        fatigue_logger.error(f"[{request_id}] Flight analysis error: {traceback.format_exc()}")
        return jsonify({'error': str(e)}), 500
    finally:
        if conn:
            conn.close()
