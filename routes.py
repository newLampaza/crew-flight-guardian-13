
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

if __name__ == '__main__':
    app.run(debug=True, port=5000)
