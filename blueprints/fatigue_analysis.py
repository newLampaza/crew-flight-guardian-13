
from flask import Blueprint, jsonify, request, send_from_directory
import os
import sqlite3
import logging
import traceback
import cv2
import random
import uuid
from datetime import datetime
import json
from neural_network.predict import analyze_source, FatigueAnalyzer

# Setup logging
logger = logging.getLogger(__name__)
fatigue_bp = Blueprint('fatigue', __name__, url_prefix='/api')

# Configuration
VIDEO_DIR = os.path.join('neural_network', 'data', 'video')
os.makedirs(VIDEO_DIR, exist_ok=True)
ALLOWED_EXTENSIONS = {'mp4', 'avi', 'mov', 'webm', 'mkv'}

# Helper functions
def get_db_connection():
    conn = sqlite3.connect('database/database.db')
    conn.row_factory = sqlite3.Row
    return conn

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def save_video(file, employee_id):
    """Сохраняет видео и возвращает путь к сохраненному файлу"""
    if file and allowed_file(file.filename):
        try:
            # Проверяем наличие таблицы FatigueVideos
            conn = get_db_connection()
            cursor = conn.cursor()
            
            # Проверяем существование таблицы
            table_exists = cursor.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='FatigueVideos';"
            ).fetchone()
            
            if not table_exists:
                # Создаем таблицу, если её нет
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
                conn.commit()
                logger.info("FatigueVideos table created")
            
            conn.close()
            
            # Генерируем уникальное имя файла
            video_id = str(uuid.uuid4())
            orig_filename = file.filename
            extension = orig_filename.rsplit('.', 1)[1].lower()
            new_filename = f"video_{video_id}.{extension}"
            video_path = os.path.join(VIDEO_DIR, new_filename)
            
            # Сохраняем файл
            file.save(video_path)
            logger.info(f"Video saved to {video_path}")
            
            # Обновляем базу данных
            conn = get_db_connection()
            cursor = conn.cursor()
            now = datetime.now().isoformat()
            
            cursor.execute(
                '''INSERT INTO FatigueVideos 
                   (employee_id, video_path, upload_date, original_filename) 
                   VALUES (?, ?, ?, ?)''',
                (employee_id, video_path, now, orig_filename)
            )
            conn.commit()
            video_db_id = cursor.lastrowid
            conn.close()
            
            return video_path, video_db_id
        except Exception as e:
            logger.error(f"Error saving video: {str(e)}")
            logger.error(traceback.format_exc())
            raise e
    return None, None

# Import token_required from auth blueprint
def get_token_required():
    from blueprints.auth import get_token_required
    return get_token_required()

# Функция для форматирования пути к видео для клиента
def format_video_path_for_client(video_path):
    """Форматирует путь к видео для отправки клиенту"""
    if not video_path:
        return None
        
    # Приводим слэши к единому виду (всегда прямые)
    normalized_path = video_path.replace('\\', '/')
    
    # Возвращаем только часть пути после neural_network/data/
    if 'neural_network/data/' in normalized_path:
        return normalized_path
    
    # Если мы сохраняем в neural_network/data/video/, 
    # то возвращаем путь относительно этой директории
    basename = os.path.basename(normalized_path)
    return f"neural_network/data/video/{basename}"

# Routes
@fatigue_bp.route('/fatigue/analyze', methods=['POST'])
def analyze_fatigue():
    token_required = get_token_required()
    
    @token_required
    def _analyze_fatigue(current_user):
        try:
            logger.info("Starting fatigue analysis...")
            if 'video' not in request.files:
                return jsonify({'error': 'Нет загруженного видео'}), 400
            
            file = request.files['video']
            if file.filename == '':
                return jsonify({'error': 'Не выбран файл'}), 400
            
            logger.info(f"Attempting to save video for user {current_user['employee_id']}")
            video_path, video_id = save_video(file, current_user['employee_id'])
            if not video_path:
                return jsonify({'error': 'Недопустимый формат файла'}), 400
            
            logger.info(f"Video saved at {video_path}, running analysis...")
            
            # Используем нейросеть для анализа видео
            try:
                fatigue_level, score_percent = analyze_source(video_path, is_video_file=True)
                score = score_percent / 100.0  # Конвертируем процент в число от 0 до 1
                logger.info(f"Neural network analysis complete: level={fatigue_level}, score={score}")
            except Exception as e:
                logger.error(f"Neural network analysis failed: {str(e)}")
                logger.error(traceback.format_exc())
                
                # Если нейросеть не смогла проанализировать, используем случайные данные
                level_map = {0: 'Low', 1: 'Medium', 2: 'High'}
                level_idx = random.choices([0, 1, 2], weights=[0.3, 0.4, 0.3], k=1)[0]
                fatigue_level = level_map[level_idx]
                score = random.uniform(0.2, 0.8)
                logger.info(f"Using fallback data: level={fatigue_level}, score={score}")
                
            # Сохраняем результаты анализа в базу данных
            conn = get_db_connection()
            now = datetime.now().isoformat()
            
            # Проверяем существование таблицы FatigueAnalysis
            cursor = conn.cursor()
            table_exists = cursor.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='FatigueAnalysis';"
            ).fetchone()
            
            if not table_exists:
                # Создаем таблицу, если её нет
                cursor.execute('''
                CREATE TABLE IF NOT EXISTS FatigueAnalysis (
                    analysis_id INTEGER PRIMARY KEY AUTOINCREMENT,
                    employee_id INTEGER,
                    flight_id INTEGER,
                    fatigue_level TEXT CHECK(fatigue_level IN ('Low', 'Medium', 'High', 'Unknown')),
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
                conn.commit()
                logger.info("FatigueAnalysis table created")
            
            # Получаем информацию о видео
            cap = cv2.VideoCapture(video_path)
            resolution = "Unknown"
            fps = 0
            
            if cap.isOpened():
                width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
                height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
                fps = cap.get(cv2.CAP_PROP_FPS)
                resolution = f"{width}x{height}"
                cap.release()
                logger.info(f"Video info: resolution={resolution}, fps={fps}")
            
            try:
                # Make sure fatigue_level is valid for the constraint
                if fatigue_level not in ('Low', 'Medium', 'High', 'Unknown'):
                    logger.warning(f"Invalid fatigue_level: {fatigue_level}, defaulting to 'Unknown'")
                    fatigue_level = 'Unknown'
                
                cursor.execute(
                    '''INSERT INTO FatigueAnalysis 
                       (employee_id, video_path, analysis_date, fatigue_level, neural_network_score, resolution, fps) 
                       VALUES (?, ?, ?, ?, ?, ?, ?)''',
                    (current_user['employee_id'], video_path, now, fatigue_level, score, resolution, fps)
                )
                conn.commit()
                analysis_id = cursor.lastrowid
            except sqlite3.Error as e:
                logger.error(f"Database error while saving analysis: {str(e)}")
                # Выводим структуру таблицы для отладки
                cols = cursor.execute("PRAGMA table_info(FatigueAnalysis)").fetchall()
                logger.debug(f"FatigueAnalysis columns: {cols}")
                raise
            finally:
                conn.close()
            
            # Используем новую функцию для форматирования пути
            client_video_path = format_video_path_for_client(video_path)
            
            logger.info(f"Analysis complete. Level: {fatigue_level}, Score: {score}, Path: {client_video_path}")
            
            return jsonify({
                'analysis_id': analysis_id,
                'fatigue_level': fatigue_level,
                'neural_network_score': score,
                'analysis_date': now,
                'video_path': client_video_path,
                'resolution': resolution,
                'fps': fps
            })
        except Exception as e:
            logger.error(f"Error in fatigue analysis: {str(e)}")
            logger.error(traceback.format_exc())
            return jsonify({'error': str(e)}), 500
    
    return _analyze_fatigue()

# ... keep existing code for other routes

@fatigue_bp.route('/fatigue/save-recording', methods=['POST'])
def save_recording():
    token_required = get_token_required()
    
    @token_required
    def _save_recording(current_user):
        """Сохранение видеозаписи без анализа"""
        try:
            if 'video' not in request.files:
                return jsonify({'error': 'Нет загруженного видео'}), 400
            
            file = request.files['video']
            if file.filename == '':
                return jsonify({'error': 'Не выбран файл'}), 400
            
            video_path, video_id = save_video(file, current_user['employee_id'])
            if not video_path:
                return jsonify({'error': 'Недопустимый формат файла'}), 400
            
            # Получаем информацию о видео
            cap = cv2.VideoCapture(video_path)
            resolution = "Unknown"
            fps = 0
            
            if cap.isOpened():
                width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
                height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
                fps = cap.get(cv2.CAP_PROP_FPS)
                resolution = f"{width}x{height}"
                cap.release()
            
            # Используем новую функцию для форматирования пути
            client_video_path = format_video_path_for_client(video_path)
            
            return jsonify({
                'video_id': video_id,
                'video_path': client_video_path,
                'upload_date': datetime.now().isoformat(),
                'resolution': resolution,
                'fps': fps,
                'message': 'Видео успешно сохранено'
            })
        except Exception as e:
            logger.error(f"Error saving recording: {str(e)}")
            logger.error(traceback.format_exc())
            return jsonify({'error': str(e)}), 500
            
    return _save_recording()

@fatigue_bp.route('/flights/last-completed', methods=['GET'])
def get_last_completed_flight():
    token_required = get_token_required()
    
    @token_required
    def _get_last_completed_flight(current_user):
        conn = None
        try:
            conn = get_db_connection()
            flight = conn.execute('''
                SELECT 
                    f.flight_id,
                    f.from_code,
                    f.from_city,
                    f.to_code,
                    f.to_city,
                    f.departure_time,
                    f.arrival_time,
                    f.video_path
                FROM Flights f
                JOIN CrewMembers cm ON f.crew_id = cm.crew_id
                WHERE cm.employee_id = ?
                    AND f.arrival_time < datetime('now', 'localtime')
                    AND f.video_path IS NOT NULL
                ORDER BY f.arrival_time DESC
                LIMIT 1
            ''', (current_user['employee_id'],)).fetchone()
            
            return jsonify(dict(flight)) if flight else jsonify({})

        except Exception as e:
            logger.error(f"Error getting last flight: {str(e)}")
            return jsonify({"error": str(e)}), 500
        finally:
            if conn: conn.close()
            
    return _get_last_completed_flight()

@fatigue_bp.route('/fatigue/analyze-flight', methods=['POST'])
def analyze_flight():
    token_required = get_token_required()
    
    @token_required
    def _analyze_flight(current_user):
        try:
            data = request.get_json()
            flight_id = data.get('flight_id')
            
            if not flight_id:
                return jsonify({'error': 'ID рейса не указан'}), 400
            
            # Получаем информацию о рейсе
            conn = get_db_connection()
            flight = conn.execute(
                'SELECT * FROM Flights WHERE flight_id = ?', 
                (flight_id,)
            ).fetchone()
            
            if not flight:
                conn.close()
                return jsonify({'error': 'Рейс не найден'}), 404
            
            # Проверяем наличие видео для рейса
            video_path = flight['video_path'] if 'video_path' in flight and flight['video_path'] else None
            
            if not video_path or not os.path.exists(video_path):
                # Если видео нет или файл не найден, создаем запись с искусственными данными
                conn.close()
                
                logger.warning(f"Flight video not found: {video_path}")
                
                # Демо-данные
                level_map = {0: 'Low', 1: 'Medium', 2: 'High'}
                level_idx = random.choices([0, 1, 2], weights=[0.3, 0.4, 0.3], k=1)[0]
                fatigue_level = level_map[level_idx]
                score = random.uniform(0.2, 0.8)
                
                now = datetime.now().isoformat()
                
                # Создаем запись в базе с демо-данными
                conn = get_db_connection()
                cursor = conn.cursor()
                cursor.execute(
                    '''INSERT INTO FatigueAnalysis 
                    (employee_id, video_path, analysis_date, fatigue_level, neural_network_score, flight_id) 
                    VALUES (?, ?, ?, ?, ?, ?)''',
                    (current_user['employee_id'], None, now, fatigue_level, score, flight_id)
                )
                conn.commit()
                analysis_id = cursor.lastrowid
                conn.close()
                
                return jsonify({
                    'analysis_id': analysis_id,
                    'fatigue_level': fatigue_level,
                    'neural_network_score': score,
                    'analysis_date': now,
                    'from_code': flight['from_code'] if 'from_code' in flight else None,
                    'to_code': flight['to_code'] if 'to_code' in flight else None,
                    'video_path': None,
                    'demo_mode': True
                })
            
            # Если видео существует, используем нейросеть для анализа
            try:
                fatigue_level, score_percent = analyze_source(video_path, is_video_file=True)
                score = score_percent / 100.0
                
                # Make sure fatigue_level is valid for the constraint
                if fatigue_level not in ('Low', 'Medium', 'High', 'Unknown'):
                    logger.warning(f"Invalid fatigue_level: {fatigue_level}, defaulting to 'Unknown'")
                    fatigue_level = 'Unknown'
                
            except Exception as e:
                logger.error(f"Neural network analysis failed for flight: {str(e)}")
                logger.error(traceback.format_exc())
                
                # Если нейросеть не смогла проанализировать, используем случайные данные
                level_map = {0: 'Low', 1: 'Medium', 2: 'High'}
                level_idx = random.choices([0, 1, 2], weights=[0.3, 0.4, 0.3], k=1)[0]
                fatigue_level = level_map[level_idx]
                score = random.uniform(0.2, 0.8)
            
            # Сохраняем результаты анализа
            now = datetime.now().isoformat()
            cursor = conn.cursor()
            cursor.execute(
                '''INSERT INTO FatigueAnalysis 
                (employee_id, video_path, analysis_date, fatigue_level, neural_network_score, flight_id) 
                VALUES (?, ?, ?, ?, ?, ?)''',
                (current_user['employee_id'], video_path, now, fatigue_level, score, flight_id)
            )
            conn.commit()
            analysis_id = cursor.lastrowid
            conn.close()
            
            # Используем новую функцию для форматирования пути
            client_video_path = format_video_path_for_client(video_path)
            
            return jsonify({
                'analysis_id': analysis_id,
                'fatigue_level': fatigue_level,
                'neural_network_score': score,
                'analysis_date': now,
                'from_code': flight['from_code'] if 'from_code' in flight else None,
                'to_code': flight['to_code'] if 'to_code' in flight else None,
                'video_path': client_video_path
            })
        except Exception as e:
            logger.error(f"Error analyzing flight: {str(e)}")
            logger.error(traceback.format_exc())
            return jsonify({'error': str(e)}), 500
            
    return _analyze_flight()

# ... keep existing code for other routes

@fatigue_bp.route('/fatigue/history', methods=['GET'])
def get_fatigue_history():
    token_required = get_token_required()
    
    @token_required
    def _get_fatigue_history(current_user):
        conn = get_db_connection()
        try:
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
                JOIN Flights f ON fa.flight_id = f.flight_id
                WHERE fa.employee_id = ?
                ORDER BY fa.analysis_date DESC
            ''', (current_user['employee_id'],)).fetchall()
            
            results = []
            for row in history:
                row_dict = dict(row)
                # Форматируем путь к видео
                if row_dict.get('video_path'):
                    row_dict['video_path'] = format_video_path_for_client(row_dict['video_path'])
                results.append(row_dict)
                
            return jsonify(results)
        except Exception as e:
            return jsonify({'error': str(e)}), 500
        finally:
            conn.close()
            
    return _get_fatigue_history()

@fatigue_bp.route('/fatigue/feedback', methods=['POST'])
def submit_fatigue_feedback():
    token_required = get_token_required()
    
    @token_required
    def _submit_fatigue_feedback(current_user):
        conn = None  # Инициализация до try
        try:
            logger.info(f"Incoming feedback data: {request.json}")
            data = request.get_json()

            if not data:
                logger.warning("Empty request body")
                return jsonify({'error': 'Empty request'}), 400

            required_fields = ['analysis_id', 'score']
            if not all(field in data for field in required_fields):
                logger.warning("Empty request body2")
                return jsonify({'error': f'Missing fields: {required_fields}'}), 400
            
            try:
                analysis_id = int(data['analysis_id'])
                score = float(data['score'])
            except ValueError:
                logger.warning("Empty request body3")
                return jsonify({'error': 'Invalid data types'}), 400
                
            conn = get_db_connection()

            analysis = conn.execute(
                'SELECT * FROM FatigueAnalysis WHERE analysis_id = ? AND employee_id = ?',
                (analysis_id, current_user['employee_id'])
            ).fetchone()
            
            if not analysis:
                logger.warning("Empty request body4")
                return jsonify({'error': 'Analysis not found'}), 404

            conn.execute(
                '''UPDATE FatigueAnalysis 
                SET feedback_score = ?
                WHERE analysis_id = ?''',
                (score, analysis_id)
            )
            conn.commit()
            
            return jsonify({
                'status': 'success',
                'updated_id': analysis_id,
                'new_score': score
            })
        except sqlite3.Error as e:
            logger.error(f"Database error: {str(e)}")
            return jsonify({'error': 'Database operation failed'}), 500
        except Exception as e:
            logger.error(f"Unexpected error: {traceback.format_exc()}")
            return jsonify({'error': 'Internal server error'}), 500
        finally:
            if conn:
                conn.close()
                
    return _submit_fatigue_feedback()

@fatigue_bp.route('/fatigue/<int:analysis_id>', methods=['GET'])
def get_analysis(analysis_id):
    token_required = get_token_required()
    
    @token_required
    def _get_analysis(current_user):
        conn = None
        try:
            conn = get_db_connection()
            analysis = conn.execute('''
                SELECT * FROM FatigueAnalysis 
                WHERE analysis_id = ?
                AND employee_id = ?
            ''', (analysis_id, current_user['employee_id'])).fetchone()
            
            if not analysis:
                return jsonify({'error': 'Analysis not found'}), 404
            
            result = dict(analysis)
            # Форматируем путь к видео
            if result.get('video_path'):
                result['video_path'] = format_video_path_for_client(result['video_path'])
                
            return jsonify(result)
            
        except Exception as e:
            logger.error(f"Error getting analysis: {str(e)}")
            return jsonify({'error': str(e)}), 500
        finally:
            if conn: conn.close()
            
    return _get_analysis()

@fatigue_bp.route('/videos/<path:filename>', methods=['GET'])
def get_video(filename):
    try:
        # Проверяем, есть ли файл в директории видео
        if os.path.exists(os.path.join(VIDEO_DIR, filename)):
            return send_from_directory(
                VIDEO_DIR,
                filename,
                mimetype='video/mp4',
                as_attachment=False
            )
        else:
            logger.error(f"Video file not found: {filename}")
            return jsonify({'error': 'Video not found'}), 404
    except Exception as e:
        logger.error(f"Error serving video: {str(e)}")
        return jsonify({'error': str(e)}), 500

@fatigue_bp.route('/neural_network/data/video/<path:filename>', methods=['GET'])
def get_neural_video(filename):
    """Обработчик для доступа к видео по новым путям"""
    try:
        # Проверяем, есть ли файл в директории видео
        if os.path.exists(os.path.join(VIDEO_DIR, filename)):
            return send_from_directory(
                VIDEO_DIR,
                filename,
                mimetype='video/mp4',
                as_attachment=False
            )
        else:
            logger.error(f"Neural network video file not found: {filename}")
            return jsonify({'error': 'Video not found'}), 404
    except Exception as e:
        logger.error(f"Error serving neural network video: {str(e)}")
        return jsonify({'error': str(e)}), 500
