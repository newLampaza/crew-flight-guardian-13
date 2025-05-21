
from flask import Blueprint, jsonify, request
from flask_cors import CORS
import jwt
from datetime import datetime, timedelta
import sqlite3
import logging
from functools import wraps
from werkzeug.security import check_password_hash, generate_password_hash

# Setup logging
logger = logging.getLogger(__name__)

# Create blueprint
auth_bp = Blueprint('auth', __name__, url_prefix='/api')
CORS(auth_bp, supports_credentials=True, expose_headers=['Authorization'])

# Helper functions
def get_db_connection():
    conn = sqlite3.connect('database/database.db')
    conn.row_factory = sqlite3.Row
    return conn

class AuthError(Exception):
    def __init__(self, error, status_code):
        self.error = error
        self.status_code = status_code

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            try:
                token = auth_header.split(" ")[1]
            except IndexError:
                raise AuthError({"code": "invalid_header",
                               "description": "Invalid header. Use 'Bearer {token}'"}, 401)
        
        if not token:
            raise AuthError({"code": "invalid_header",
                           "description": "Token missing"}, 401)
        
        try:
            from routes import app
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
            conn = get_db_connection()
            current_user = conn.execute(
                'SELECT * FROM Users WHERE username = ?', 
                (data['username'],)
            ).fetchone()
            conn.close()
            
            if not current_user:
                raise AuthError({"code": "invalid_user",
                               "description": "User not found"}, 401)
                
        except jwt.ExpiredSignatureError:
            raise AuthError({"code": "token_expired",
                           "description": "Token has expired"}, 401)
        except jwt.InvalidTokenError:
            raise AuthError({"code": "invalid_token",
                           "description": "Invalid token"}, 401)
            
        return f(current_user, *args, **kwargs)
    return decorated

def create_tokens(user, app_config):
    access_token = jwt.encode({
        'username': user['username'],
        'exp': datetime.utcnow() + app_config['JWT_ACCESS_TOKEN_EXPIRES']
    }, app_config['SECRET_KEY'])
    
    refresh_token = jwt.encode({
        'username': user['username'],
        'exp': datetime.utcnow() + app_config['JWT_REFRESH_TOKEN_EXPIRES']
    }, app_config['SECRET_KEY'])
    
    return access_token, refresh_token

# Routes
@auth_bp.route('/login', methods=['POST'])
def login():
    try:
        auth = request.get_json()
        if not auth or not auth.get('username') or not auth.get('password'):
            raise AuthError({"code": "invalid_credentials",
                           "description": "Missing username or password"}, 400)

        conn = get_db_connection()
        
        # Получаем информацию о пользователе с присоединением данных из таблицы Employees
        user = conn.execute('''
            SELECT u.*, e.name, e.role, e.position, e.image_url 
            FROM Users u
            LEFT JOIN Employees e ON u.employee_id = e.employee_id
            WHERE u.username = ?
        ''', (auth['username'],)).fetchone()
        
        conn.close()

        if not user:
            raise AuthError({"code": "invalid_credentials",
                           "description": "User not found"}, 404)

        if not check_password_hash(user['password'], auth['password']):
            logger.warning(f"Invalid password for user: {auth['username']}")
            raise AuthError({"code": "invalid_credentials",
                           "description": "Invalid password"}, 401)

        from routes import app
        access_token, refresh_token = create_tokens(user, app.config)
        
        # Формируем объект пользователя для отправки клиенту
        user_data = {
            'id': user['user_id'],
            'username': user['username'],
            'name': user['name'],
            'role': user['role'],
            'position': user['position'],
            'avatarUrl': user['image_url']
        }

        return jsonify({
            'token': access_token,
            'refresh_token': refresh_token,
            'user': user_data
        })

    except AuthError as e:
        return jsonify(e.error), e.status_code
    except Exception as e:
        logger.error(f"Login error: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500

@auth_bp.route('/refresh-token', methods=['POST'])
def refresh_token():
    try:
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            raise AuthError({"code": "invalid_header",
                           "description": "No refresh token provided"}, 401)
        
        try:
            refresh_token = auth_header.split(" ")[1]
        except IndexError:
            raise AuthError({"code": "invalid_header",
                           "description": "Invalid header format"}, 401)

        try:
            from routes import app
            data = jwt.decode(refresh_token, app.config['SECRET_KEY'], algorithms=["HS256"])
            conn = get_db_connection()
            user = conn.execute('SELECT * FROM Users WHERE username = ?', 
                              (data['username'],)).fetchone()
            conn.close()

            if not user:
                raise AuthError({"code": "invalid_token",
                               "description": "User not found"}, 401)

            new_access_token, new_refresh_token = create_tokens(user, app.config)

            return jsonify({
                'token': new_access_token,
                'refresh_token': new_refresh_token
            })

        except jwt.ExpiredSignatureError:
            raise AuthError({"code": "token_expired",
                           "description": "Refresh token has expired"}, 401)
        except jwt.InvalidTokenError:
            raise AuthError({"code": "invalid_token",
                           "description": "Invalid refresh token"}, 401)

    except AuthError as e:
        return jsonify(e.error), e.status_code
    except Exception as e:
        logger.error(f"Token refresh error: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500

@auth_bp.route('/user-profile', methods=['GET'])
@token_required
def get_user_profile(current_user):
    try:
        conn = get_db_connection()
        # Получаем полную информацию о пользователе
        user_data = conn.execute('''
            SELECT u.*, e.name, e.role, e.position, e.image_url 
            FROM Users u
            LEFT JOIN Employees e ON u.employee_id = e.employee_id
            WHERE u.user_id = ?
        ''', (current_user['user_id'],)).fetchone()
        conn.close()

        if not user_data:
            return jsonify({"error": "User not found"}), 404

        return jsonify({
            'id': user_data['user_id'],
            'username': user_data['username'],
            'name': user_data['name'],
            'role': user_data['role'],
            'position': user_data['position'],
            'avatarUrl': user_data['image_url']
        })

    except Exception as e:
        logger.error(f"Error getting user profile: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500

@auth_bp.route('/validate-token', methods=['GET'])
@token_required
def validate_token(current_user):
    return jsonify({'valid': True})

@auth_bp.route('/logout', methods=['POST'])
@token_required
def logout(current_user):
    # В будущем здесь можно добавить инвалидацию токена
    return jsonify({'message': 'Successfully logged out'})

@auth_bp.errorhandler(AuthError)
def handle_auth_error(ex):
    response = jsonify(ex.error)
    response.status_code = ex.status_code
    return response

# Export token_required to be used by other blueprints
def get_token_required():
    return token_required
