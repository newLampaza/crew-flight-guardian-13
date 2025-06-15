from logging.handlers import RotatingFileHandler
import os
from flask import Flask, send_from_directory, jsonify, request, Response
from flask_cors import CORS
import logging
from datetime import timedelta
from functools import wraps

# Import blueprints
from blueprints.auth import auth_bp, AuthError, handle_auth_error
from blueprints.fatigue_analysis import fatigue_bp
from blueprints.cognitive_tests import cognitive_bp
from blueprints.user_data import user_bp
from blueprints.feedback import feedback_bp
from blueprints.debug import debug_bp

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        RotatingFileHandler(
            'app.log',
            maxBytes=1024*1024*5,  # 5 MB
            backupCount=3,
            encoding='utf-8'
        ),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)

# Create Flask app
app = Flask(__name__)
CORS(app, 
     supports_credentials=True, 
     expose_headers=['Authorization'], 
     resources={r"/api/*": {"origins": "*"}},
     methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"])
app.config['SECRET_KEY'] = os.urandom(24).hex()
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=1)
app.config['JWT_REFRESH_TOKEN_EXPIRES'] = timedelta(days=30)

# Register error handlers
@app.errorhandler(AuthError)
def handle_auth_error_app(ex):
    return handle_auth_error(ex)

@app.errorhandler(404)
def not_found(error):
    return jsonify({"error": "Route not found"}), 404

@app.errorhandler(500)
def server_error(error):
    logger.error(f"Server error: {error}")
    return jsonify({"error": "Internal server error"}), 500

# Register blueprints
app.register_blueprint(auth_bp)
app.register_blueprint(fatigue_bp)
app.register_blueprint(cognitive_bp)
app.register_blueprint(user_bp)
app.register_blueprint(feedback_bp)
app.register_blueprint(debug_bp)

# Serve static files
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    static_dir = 'site/dist'
    if not os.path.exists(static_dir):
        logger.error(f"Static directory '{static_dir}' does not exist")
        return jsonify({"error": "Static files directory not found"}), 500
        
    if path and os.path.exists(os.path.join(static_dir, path)):
        return send_from_directory(static_dir, path)
    elif os.path.exists(os.path.join(static_dir, 'index.html')):
        return send_from_directory(static_dir, 'index.html')
    else:
        logger.error(f"index.html not found in {static_dir}")
        return jsonify({"error": "Frontend not built. Please run 'npm run build' first."}), 500

def get_video_file_path(filename):
    """Find video file by filename only"""
    logger.info(f"[VIDEO_SEARCH] Starting search for video file: '{filename}'")
    
    video_dir = os.path.join('neural_network', 'data', 'video')
    logger.info(f"[VIDEO_SEARCH] Video directory: '{video_dir}'")
    logger.info(f"[VIDEO_SEARCH] Video directory exists: {os.path.exists(video_dir)}")
    
    # Log directory contents
    if os.path.exists(video_dir):
        try:
            files_in_dir = os.listdir(video_dir)
            logger.info(f"[VIDEO_SEARCH] Files in video directory ({len(files_in_dir)} total):")
            for i, file in enumerate(files_in_dir[:10]):  # Show first 10 files
                logger.info(f"[VIDEO_SEARCH]   {i+1}. '{file}'")
            if len(files_in_dir) > 10:
                logger.info(f"[VIDEO_SEARCH]   ... and {len(files_in_dir) - 10} more files")
        except Exception as e:
            logger.error(f"[VIDEO_SEARCH] Error listing directory contents: {e}")
    
    # Remove any path prefixes and use only the filename
    original_filename = filename
    if filename.startswith('/videos/'):
        filename = filename[8:]  # Remove '/videos/' prefix
        logger.info(f"[VIDEO_SEARCH] Removed '/videos/' prefix: '{original_filename}' -> '{filename}'")
    elif filename.startswith('/video/'):
        filename = filename[7:]   # Remove '/video/' prefix
        logger.info(f"[VIDEO_SEARCH] Removed '/video/' prefix: '{original_filename}' -> '{filename}'")
    
    logger.info(f"[VIDEO_SEARCH] Final filename to search: '{filename}'")
    
    # Check if file exists directly
    direct_path = os.path.join(video_dir, filename)
    logger.info(f"[VIDEO_SEARCH] Checking direct path: '{direct_path}'")
    logger.info(f"[VIDEO_SEARCH] Direct path exists: {os.path.exists(direct_path)}")
    
    if os.path.exists(direct_path):
        logger.info(f"[VIDEO_SEARCH] ✓ Found video file at direct path: {direct_path}")
        return direct_path
    
    # Search recursively if not found directly
    logger.info(f"[VIDEO_SEARCH] Starting recursive search in '{video_dir}'")
    found_files = []
    
    for root, dirs, files in os.walk(video_dir):
        logger.info(f"[VIDEO_SEARCH] Searching in subdirectory: '{root}' (contains {len(files)} files)")
        
        for file in files:
            if file == filename:
                found_path = os.path.join(root, file)
                found_files.append(found_path)
                logger.info(f"[VIDEO_SEARCH] ✓ Found matching file: '{found_path}'")
            
            # Log partial matches for debugging
            if filename.lower() in file.lower() or file.lower() in filename.lower():
                logger.info(f"[VIDEO_SEARCH] Partial match found: '{file}' (looking for '{filename}')")
    
    if found_files:
        result_path = found_files[0]
        logger.info(f"[VIDEO_SEARCH] ✓ Returning first found file: {result_path}")
        return result_path
    
    logger.error(f"[VIDEO_SEARCH] ✗ Video file '{filename}' not found in '{video_dir}' or subdirectories")
    return None

def stream_video(file_path):
    """Stream video with Range request support"""
    def generate():
        with open(file_path, 'rb') as f:
            data = f.read(8192)
            while data:
                yield data
                data = f.read(8192)
    
    file_size = os.path.getsize(file_path)
    range_header = request.headers.get('Range')
    
    if not range_header:
        response = Response(
            generate(),
            status=200,
            headers={
                'Content-Type': 'video/mp4',
                'Content-Length': str(file_size),
                'Accept-Ranges': 'bytes',
                'Cache-Control': 'no-cache',
                'Content-Disposition': 'inline'
            }
        )
        return response
    
    # Handle Range requests
    byte_start = 0
    byte_end = file_size - 1
    
    if range_header:
        match = range_header.replace('bytes=', '').split('-')
        if len(match) == 2:
            if match[0]:
                byte_start = int(match[0])
            if match[1]:
                byte_end = int(match[1])
    
    content_length = byte_end - byte_start + 1
    
    def generate_range():
        with open(file_path, 'rb') as f:
            f.seek(byte_start)
            remaining = content_length
            while remaining:
                chunk_size = min(8192, remaining)
                data = f.read(chunk_size)
                if not data:
                    break
                remaining -= len(data)
                yield data
    
    response = Response(
        generate_range(),
        status=206,
        headers={
            'Content-Type': 'video/mp4',
            'Accept-Ranges': 'bytes',
            'Content-Range': f'bytes {byte_start}-{byte_end}/{file_size}',
            'Content-Length': str(content_length),
            'Cache-Control': 'no-cache',
            'Content-Disposition': 'inline'
        }
    )
    
    return response

@app.route('/api/video/<path:filename>')
def serve_video(filename):
    """Serve video files with streaming support"""
    logger.info(f"[VIDEO_REQUEST] Video request received: '{filename}'")
    
    file_path = get_video_file_path(filename)
    
    if file_path and os.path.exists(file_path):
        logger.info(f"[VIDEO_REQUEST] ✓ Found video file: '{file_path}'")
        try:
            return stream_video(file_path)
        except Exception as e:
            logger.error(f"[VIDEO_REQUEST] ✗ Error streaming video '{filename}': {e}")
            return jsonify({"error": "Video streaming error"}), 500
    
    logger.error(f"[VIDEO_REQUEST] ✗ Video file not found: '{filename}'")
    return jsonify({"error": "Video file not found"}), 404

# Test sessions storage for cognitive tests
test_sessions = {}

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Здесь пример получения пользователя из сессии/jwt
        user_id = request.headers.get("X-User-Id") or None
        if not user_id:
            return jsonify({"error": "Unauthorized"}), 401
        g.current_user_id = int(user_id)
        return f(*args, **kwargs)
    return decorated_function

@app.route("/api/flightstats", methods=["GET"])
@login_required
def get_flight_stats():
    """
    Возвращает статистику полетов для текущего пользователя:
    flights and hours — за неделю и за месяц
    Использует таблицу Flights и соответствие user=employee_id
    """
    import sqlite3

    conn = sqlite3.connect("database/database.db")
    cur = conn.cursor()

    user_id = g.current_user_id

    # Парсим даты
    today = datetime.today()
    week_ago = today - timedelta(days=7)
    month_ago = today - timedelta(days=30)

    # За неделю: считаем количество рейсов и суммарные часы (разница прибытия/отправления)
    cur.execute("""
        SELECT COUNT(*), SUM(
          (julianday(arrival_time) - julianday(departure_time))*24.0
        )
        FROM Flights
        WHERE employee_id=?
          AND departure_time >= ?
    """, (user_id, week_ago.strftime("%Y-%m-%d %H:%M:%S")))
    weekly_flights, weekly_hours = cur.fetchone()
    weekly_flights = weekly_flights or 0
    weekly_hours = round(weekly_hours or 0, 1)

    # За месяц: то же самое
    cur.execute("""
        SELECT COUNT(*), SUM(
          (julianday(arrival_time) - julianday(departure_time))*24.0
        )
        FROM Flights
        WHERE employee_id=?
          AND departure_time >= ?
    """, (user_id, month_ago.strftime("%Y-%m-%d %H:%M:%S")))
    monthly_flights, monthly_hours = cur.fetchone()
    monthly_flights = monthly_flights or 0
    monthly_hours = round(monthly_hours or 0, 1)

    conn.close()

    return jsonify({
        "weeklyFlights": weekly_flights,
        "weeklyHours": weekly_hours,
        "monthlyFlights": monthly_flights,
        "monthlyHours": monthly_hours
    })

@app.route("/api/crew", methods=["GET"])
@login_required
def get_crew():
    """
    Возвращает текущий экипаж для пользователя (или обороты пользователя, если данная логика нужна).
    Для MVP — пусть вернёт экипаж текущего последнего (самого свежего) рейса пользователя.
    """
    import sqlite3

    conn = sqlite3.connect("database/database.db")
    cur = conn.cursor()

    user_id = g.current_user_id

    # Получим последний рейс пользователя
    cur.execute(
        """
        SELECT id, flight_code
        FROM Flights
        WHERE employee_id=?
        ORDER BY departure_time DESC
        LIMIT 1
        """,
        (user_id,),
    )
    row = cur.fetchone()
    if not row:
        conn.close()
        return jsonify([])  # Нет рейсов — нет экипажа

    flight_id, flight_code = row

    # Получим ВСЕХ сотрудников (экипаж) этого рейса
    cur.execute(
        """
        SELECT Employees.id, Employees.full_name, CrewMembers.position
        FROM CrewMembers
        JOIN Employees ON CrewMembers.employee_id = Employees.id
        WHERE CrewMembers.flight_id=?
        """,
        (flight_id,),
    )
    crew = [
        {"id": emp_id, "name": full_name, "position": position}
        for (emp_id, full_name, position) in cur.fetchall()
    ]
    conn.close()
    return jsonify(crew)

if __name__ == '__main__':
    app.run(debug=True, port=5000)
