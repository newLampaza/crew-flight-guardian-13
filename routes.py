from logging.handlers import RotatingFileHandler
import os
from flask import Flask, send_from_directory, jsonify, request, Response
from flask_cors import CORS
import logging
from datetime import timedelta

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

from flask import g
import csv
import datetime

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

@app.route('/api/dashboard')
def api_dashboard():
    """ Возвращает агрегированные актуальные данные для панели пользователя """

    # --- Заглушка user_id (в реальном проекте сюда интегрируется auth/session) ---
    # Сначала ищем первого пилота в Users.csv по роли pilot
    users_path = "DatabaseTables/Users.csv"
    employees_path = "DatabaseTables/Employees.csv"
    crew_members_path = "DatabaseTables/CrewMembers.csv"
    crews_path = "DatabaseTables/Crews.csv"
    fatigue_analysis_path = "DatabaseTables/FatigueAnalysis.csv"
    cognitive_tests_path = "DatabaseTables/CognitiveTests.csv"
    medical_checks_path = "DatabaseTables/MedicalChecks.csv"

    user_row = None
    employee_row = None
    employee_id = None

    try:
        # Ищем первого user-а с ролью 'pilot'
        with open(users_path, newline='', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                if row["role"] == "pilot":
                    user_row = row
                    employee_id = row["employee_id"]
                    break

        # Получаем сотрудника (employee) для профиля
        if employee_id:
            with open(employees_path, newline='', encoding='utf-8') as f:
                ereader = csv.DictReader(f)
                for erow in ereader:
                    if erow["employee_id"] == employee_id:
                        employee_row = erow
                        break

        # Статистика полетов (примерная логика, заменить по необходимости)
        # Считаем по FatigueAnalysis.csv анализы типа flight для этого сотрудника + даты
        week_start = (datetime.datetime.now() - datetime.timedelta(days=6)).date()
        month_start = (datetime.datetime.now() - datetime.timedelta(days=29)).date()
        now = datetime.datetime.now()
        weekly_flights = 0
        weekly_hours = 0
        monthly_flights = 0
        monthly_hours = 0

        with open(fatigue_analysis_path, newline='', encoding='utf-8') as f:
            fanalyzer = csv.DictReader(f)
            for row in fanalyzer:
                if row["analysis_type"] == "flight" and row["employee_id"] == employee_id:
                    analysis_date_str = row["analysis_date"]
                    try:
                        # Совместимость с двумя вариантами даты
                        if "T" in analysis_date_str:
                            analysis_date = datetime.datetime.fromisoformat(analysis_date_str.split(",")[0])
                        else:
                            analysis_date = datetime.datetime.strptime(analysis_date_str.split(",")[0], '%Y-%m-%d %H:%M:%S')
                        adate = analysis_date.date()
                        duration = float(row["fps"]) if "fps" in row and row["fps"] else 2.0 # МИНУТЫ для проверки
                        # Учтите: по вашему CSV поле часов не задается — добавьте row["duration"] если появится!
                        if adate >= week_start:
                            weekly_flights += 1
                            weekly_hours += duration / 60.0 # демо расчет
                        if adate >= month_start:
                            monthly_flights += 1
                            monthly_hours += duration / 60.0 # демо расчет
                    except Exception:
                        pass
        # Экипаж — ищем crew_id, crew_name, членов экипажа (mocks)
        active_crew_id = None
        crew_name = None
        crew_members = []
        with open(crew_members_path, newline='', encoding='utf-8') as f:
            cmreader = csv.DictReader(f)
            for row in cmreader:
                if row["employee_id"] == employee_id:
                    active_crew_id = row["crew_id"]
                    break

        if active_crew_id:
            with open(crews_path, newline='', encoding='utf-8') as f:
                creader = csv.DictReader(f)
                for row in creader:
                    if row["crew_id"] == active_crew_id:
                        crew_name = row["crew_name"]
                        break
            # Получаем членов экипажа:
            with open(crew_members_path, newline='', encoding='utf-8') as f:
                cmreader = csv.DictReader(f)
                for row in cmreader:
                    if row["crew_id"] == active_crew_id:
                        # Получаем имя каждого члена
                        member_id = row["employee_id"]
                        with open(employees_path, newline='', encoding='utf-8') as ef:
                            emreader = csv.DictReader(ef)
                            for em in emreader:
                                if em["employee_id"] == member_id:
                                    crew_members.append({
                                        "name": em["name"],
                                        "position": em["position"]
                                    })
                                    break

        # Last Fatigue Analysis (realtime)
        last_fatigue = None
        with open(fatigue_analysis_path, newline='', encoding='utf-8') as f:
            fanalyzer = list(csv.DictReader(f))
            last_fan = None
            for row in reversed(fanalyzer):
                if row["employee_id"] == employee_id and row["analysis_type"] == "realtime":
                    last_fan = row
                    break
            if last_fan:
                last_fatigue = {
                    "fatigue_level": last_fan["fatigue_level"],
                    "neural_network_score": last_fan["neural_network_score"],
                    "analysis_date": last_fan["analysis_date"],
                }
        # Last Cognitive Tests
        tests_status = []
        with open(cognitive_tests_path, newline='', encoding='utf-8') as f:
            creader = list(csv.DictReader(f))
            for type_name in ["attention", "reaction", "memory"]:
                last_test = next((row for row in reversed(creader)
                                  if row["employee_id"] == employee_id and row["test_type"] == type_name), None)
                if last_test:
                    tests_status.append({
                        "type": type_name,
                        "date": last_test["test_date"],
                        "score": last_test["score"],
                        "details": last_test["details"]
                    })

        # Medical info (last check)
        medical_info = None
        with open(medical_checks_path, newline='', encoding='utf-8') as f:
            mreader = list(csv.DictReader(f))
            last_check = None
            for row in reversed(mreader):
                if row["employee_id"] == employee_id:
                    last_check = row
                    break
            if last_check:
                medical_info = {
                    "check_date": last_check["check_date"],
                    "expiry_date": last_check["expiry_date"],
                    "status": last_check["status"],
                    "doctor_name": last_check["doctor_name"],
                    "notes": last_check["notes"]
                }

        # Ответ формируется:
        return jsonify({
            "user": {
                "name": employee_row["name"] if employee_row else "",
                "position": employee_row["position"] if employee_row else "",
                "role": employee_row["role"] if employee_row else "",
                "avatarUrl": employee_row["image_url"] if employee_row else "",
            },
            "flightStats": {
                "weeklyFlights": weekly_flights,
                "weeklyHours": int(weekly_hours),
                "monthlyFlights": monthly_flights,
                "monthlyHours": int(monthly_hours),
            },
            "crew": {
                "crew_name": crew_name,
                "members": crew_members
            },
            "lastFatigue": last_fatigue,
            "testsStatus": tests_status,
            "medical": medical_info
        })

    except Exception as e:
        logger.error(f"[DASHBOARD_API] Ошибка формирования dashboard данных: {e}")
        return jsonify({"error": str(e)}), 500

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

if __name__ == '__main__':
    app.run(debug=True, port=5000)
