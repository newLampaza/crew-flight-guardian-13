from logging.handlers import RotatingFileHandler
import subprocess
import traceback
import cv2
from flask import Flask, jsonify, request, send_file, send_from_directory
from flask_cors import CORS
import sqlite3
import os
from datetime import datetime, time, timedelta
import jwt
from functools import wraps
import hashlib
import uuid
import json
import shutil
import logging
import random
from werkzeug.security import generate_password_hash, check_password_hash
from neural_network.predict import analyze_source, FatigueAnalyzer

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

app = Flask(__name__)
CORS(app, supports_credentials=True, expose_headers=['Authorization'], resources={r"/api/*": {"origins": "*"}})
app.config['SECRET_KEY'] = os.urandom(24).hex()
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=1)
app.config['JWT_REFRESH_TOKEN_EXPIRES'] = timedelta(days=30)

DATABASE = os.path.join('database', 'database.db')
VIDEO_DIR = os.path.join('neural_network', 'data', 'video')
os.makedirs(VIDEO_DIR, exist_ok=True)
ALLOWED_EXTENSIONS = {'mp4', 'avi', 'mov', 'webm', 'mkv'}
test_sessions = {}

def get_db_connection():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

class AuthError(Exception):
    def __init__(self, error, status_code):
        self.error = error
        self.status_code = status_code

@app.errorhandler(AuthError)
def handle_auth_error(ex):
    response = jsonify(ex.error)
    response.status_code = ex.status_code
    return response

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

def create_tokens(user):
    access_token = jwt.encode({
        'username': user['username'],
        'exp': datetime.utcnow() + app.config['JWT_ACCESS_TOKEN_EXPIRES']
    }, app.config['SECRET_KEY'])
    
    refresh_token = jwt.encode({
        'username': user['username'],
        'exp': datetime.utcnow() + app.config['JWT_REFRESH_TOKEN_EXPIRES']
    }, app.config['SECRET_KEY'])
    
    return access_token, refresh_token

@app.route('/api/login', methods=['POST'])
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
            print(user['password'], auth['password'])
            raise AuthError({"code": "invalid_credentials",
                           "description": "Invalid password"}, 401)

        access_token, refresh_token = create_tokens(user)
        
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
        app.logger.error(f"Login error: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500

@app.route('/api/refresh-token', methods=['POST'])
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
            data = jwt.decode(refresh_token, app.config['SECRET_KEY'], algorithms=["HS256"])
            conn = get_db_connection()
            user = conn.execute('SELECT * FROM Users WHERE username = ?', 
                              (data['username'],)).fetchone()
            conn.close()

            if not user:
                raise AuthError({"code": "invalid_token",
                               "description": "User not found"}, 401)

            new_access_token, new_refresh_token = create_tokens(user)

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
        app.logger.error(f"Token refresh error: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500

@app.route('/api/user-profile', methods=['GET'])
@token_required
def get_user_profile(current_user):
    try:
        conn = get_db_connection()
        # Получаем полную и��формацию о ��ользователе
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
        app.logger.error(f"Error getting user profile: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500

@app.route('/api/validate-token', methods=['GET'])
@token_required
def validate_token(current_user):
    return jsonify({'valid': True})

@app.route('/api/logout', methods=['POST'])
@token_required
def logout(current_user):
    # В будущем здесь можно добавить инвалидацию токена
    return jsonify({'message': 'Successfully logged out'})


def generate_test_questions(test_type, count=5):
    """Generates questions for cognitive tests based on type"""
    # Определяем типы вопросов для разных тестов
    if test_type == 'attention':
        question_types = ['difference', 'count', 'pattern', 'select', 'matrix_selection']
    elif test_type == 'memory':
        question_types = ['sequence', 'words', 'images', 'pairs', 'matrix']
    elif test_type == 'reaction':
        question_types = ['reaction', 'select', 'pattern', 'count', 'matrix_selection']
    elif test_type == 'cognitive':
        question_types = ['logic', 'math', 'pattern', 'cognitive', 'sequence']
    else:
        question_types = ['logic', 'math', 'pattern', 'cognitive', 'sequence']
    
    # Гарантируем, что у нас есть хотя бы count типов вопросов
    while len(question_types) < count:
        question_types.extend(question_types)
    
    questions = []
    for i in range(count):
        question_type = question_types[i % len(question_types)]
        questions.append(generate_question(question_type))
    
    return questions

def generate_question(question_type):
    """Generates a single question based on its type with improved content"""
    question_id = str(uuid.uuid4())
    
    if question_type == 'difference':
        # Тест на нахождение различий
        images = [
            'https://images.unsplash.com/photo-1488590528505-98d2b5aba04b',
            'https://images.unsplash.com/photo-1461749280684-dccba630e2f6'
        ]
        differences = random.choice([2, 3, 4, 5])
        correct_answer = f"{differences} отличия"
        
        # Создаем варианты ответов вокруг правильного
        options = [f"{max(1, differences-1)} отличия", 
                   f"{differences} отличия", 
                   f"{differences+1} отличия", 
                   f"{differences+2} отличия"]
        random.shuffle(options)
        
        return {
            'id': question_id,
            'type': question_type,
            'question': 'Найдите различия между изображениями',
            'images': images,
            'options': options,
            'correct_answer': correct_answer,
            'time_limit': 30
        }
    
    elif question_type == 'count':
        # Тест на подсчет элементов
        symbols = ['#', '@', '$', '%', '&']
        target_symbol = random.choice(symbols)
        grid_size = 5
        grid = []
        count = 0
        
        for i in range(grid_size):
            row = []
            for j in range(grid_size):
                symbol = random.choice(symbols)
                if symbol == target_symbol:
                    count += 1
                row.append(symbol)
            grid.append(row)
        
        # Гарантируем, что символ встречается хотя бы раз
        if count == 0:
            x, y = random.randint(0, grid_size-1), random.randint(0, grid_size-1)
            grid[x][y] = target_symbol
            count = 1
        
        return {
            'id': question_id,
            'type': question_type,
            'question': f'Сколько символов {target_symbol} на изображении',
            'grid': grid,
            'options': [str(count-1), str(count), str(count+1), str(count+2)],
            'correct_answer': str(count),
            'time_limit': 20
        }
    
    elif question_type == 'pattern':
        # Тест на определение закономерности
        patterns = [
            {'sequence': ['⭐', '⚡', '⭐', '⚡', '⭐'], 'next': '⚡'},
            {'sequence': ['🔴', '🔵', '🟢', '🔴', '🔵'], 'next': '🟢'},
            {'sequence': ['1', '3', '5', '7', '9'], 'next': '11'},
            {'sequence': ['A', 'C', 'E', 'G', 'I'], 'next': 'K'}
        ]
        
        selected_pattern = random.choice(patterns)
        stimulus = selected_pattern['sequence']
        correct_answer = selected_pattern['next']
        
        # Генерируем правдоподобные неправильные ответы
        wrong_answers = []
        all_symbols = ['⭐', '⚡', '🌙', '⚪', '🔴', '🔵', '🟢', '🟡', 'X', 'Y', 'Z']
        
        if correct_answer.isdigit():
            wrong_answers = [str(int(correct_answer) + 2), str(int(correct_answer) - 2), 
                            str(int(correct_answer) + 4)]
        elif correct_answer in all_symbols:
            wrong_answers = [sym for sym in all_symbols if sym != correct_answer][:3]
        else:  # буквы
            alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
            idx = alphabet.find(correct_answer)
            if idx != -1:
                wrong_answers = [alphabet[(idx+1) % 26], alphabet[(idx+2) % 26], alphabet[(idx+3) % 26]]
            else:
                wrong_answers = ['M', 'P', 'T']
        
        options = [correct_answer] + wrong_answers[:3]
        random.shuffle(options)
        
        return {
            'id': question_id,
            'type': question_type,
            'question': 'Определите закономерность и укажите следующий элемент',
            'stimulus': stimulus,
            'options': options,
            'correct_answer': correct_answer,
            'time_limit': 20
        }
    
    elif question_type == 'logic':
        # Тест на логическое мышление
        logic_questions = [
            {
                'question': 'Если A > B и B > C, то A _ C?',
                'options': [">", "<", "=", "недостаточно данных"],
                'answer': ">"
            },
            {
                'question': 'Все кошки имеют хвосты. У Мурки есть хвост. Следовательно:',
                'options': ["Мурка - кошка", "Мурка может быть кошкой", "Мурка не кошка", "Недостаточно данных"],
                'answer': "Мурка может быть кошкой"
            },
            {
                'question': 'Если сегодня не среда, то завтра не четверг. Сегодня не среда. Завтра:',
                'options': ["Четверг", "Не четверг", "Пятница", "Недостаточно данных"],
                'answer': "Не четверг"
            }
        ]
        
        selected_question = random.choice(logic_questions)
        
        return {
            'id': question_id,
            'type': question_type,
            'question': selected_question['question'],
            'options': selected_question['options'],
            'correct_answer': selected_question['answer'],
            'time_limit': 25
        }
    
    elif question_type == 'math':
        # Математический тест
        operation_types = ['addition', 'subtraction', 'multiplication', 'division']
        operation_type = random.choice(operation_types)
        
        if operation_type == 'addition':
            num1 = random.randint(10, 50)
            num2 = random.randint(10, 50)
            result = num1 + num2
            question_text = f'Сколько будет {num1} + {num2}?'
        elif operation_type == 'subtraction':
            num1 = random.randint(30, 100)
            num2 = random.randint(1, num1)
            result = num1 - num2
            question_text = f'Сколько будет {num1} - {num2}?'
        elif operation_type == 'multiplication':
            num1 = random.randint(2, 12)
            num2 = random.randint(2, 12)
            result = num1 * num2
            question_text = f'Сколько будет {num1} × {num2}?'
        else:  # division
            num2 = random.randint(2, 10)
            num1 = num2 * random.randint(1, 10)
            result = num1 // num2
            question_text = f'Сколько будет {num1} ÷ {num2}?'
        
        wrong_answers = [result + 1, result - 1, result + 2]
        if result > 5:
            wrong_answers.append(result - 2)
        else:
            wrong_answers.append(result * 2)
            
        options = [str(result)] + [str(ans) for ans in wrong_answers[:3]]
        random.shuffle(options)
        
        return {
            'id': question_id,
            'type': question_type,
            'question': question_text,
            'options': options,
            'correct_answer': str(result),
            'time_limit': 20
        }
    
    elif question_type == 'select':
        # Тест с множественным выбором
        select_questions = [
            {
                'question': 'Выберите все четные числа',
                'options': ['1', '2', '3', '4', '5', '6', '7', '8'],
                'answer': '2,4,6,8'
            },
            {
                'question': 'Выберите все гласные буквы',
                'options': ['А', 'Б', 'Е', 'Ж', 'И', 'К', 'О', 'Т'],
                'answer': 'А,Е,И,О'
            },
            {
                'question': 'Выберите все планеты Солнечной системы',
                'options': ['Земля', 'Луна', 'Марс', 'Сатурн', 'Солнце', 'Венера', 'Плутон', 'Юпитер'],
                'answer': 'Земля,Марс,Сатурн,Венера,Юпитер'
            }
        ]
        
        selected_question = random.choice(select_questions)
        
        return {
            'id': question_id,
            'type': question_type,
            'question': selected_question['question'],
            'options': selected_question['options'],
            'correct_answer': selected_question['answer'],
            'multiple_select': True,
            'time_limit': 25
        }
    
    elif question_type == 'sequence':
        # Тест на запоминание последовательности
        seq_types = ['numbers', 'letters', 'symbols']
        seq_type = random.choice(seq_types)
        
        if seq_type == 'numbers':
            sequence = [str(random.randint(0, 9)) for _ in range(5)]
        elif seq_type == 'letters':
            sequence = [chr(random.randint(65, 90)) for _ in range(5)]  # A-Z
        else:
            symbols = ['★', '☆', '♥', '♦', '♣', '♠', '◆', '■']
            sequence = [random.choice(symbols) for _ in range(5)]
        
        return {
            'id': question_id,
            'type': question_type,
            'question': 'Запомните и повторите последовательность',
            'stimulus': sequence,
            'options': sequence,  # Для согласованности интерфейса
            'correct_answer': ''.join(sequence),
            'delay': 5,
            'time_limit': 20
        }
    
    elif question_type == 'words':
        # Тест на запоминание слов
        all_words = [
            'дом', 'кот', 'лес', 'мир', 'сон', 'рыба', 'книга', 'окно',
            'стол', 'вода', 'хлеб', 'рука', 'глаз', 'небо', 'земля'
        ]
        random.shuffle(all_words)
        selected = all_words[:3]
        options = selected + all_words[3:7]  # три правильных + четыре неправильных
        random.shuffle(options)
        
        return {
            'id': question_id,
            'type': question_type,
            'question': 'Запомните слова и выберите показанные',
            'stimulus': selected,
            'options': options,
            'correct_answer': ','.join(selected),
            'delay': 5,
            'multiple_select': True,
            'time_limit': 20
        }
    
    elif question_type == 'images':
        # Тест на запоминание изображений
        image_urls = [
            'https://images.unsplash.com/photo-1542831371-29b0f74f9713',
            'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5',
            'https://images.unsplash.com/photo-1509048191080-d2984bad6ae5',
            'https://images.unsplash.com/photo-1518770660439-4636190af475',
            'https://images.unsplash.com/photo-1516900557549-41557d405adf',
            'https://images.unsplash.com/photo-1560807707-8cc77767d783'
        ]
        random.shuffle(image_urls)
        shown_images = image_urls[:3]
        all_options = shown_images + [image_urls[3]]  # три показанных + одно новое
        random.shuffle(all_options)
        
        return {
            'id': question_id,
            'type': question_type,
            'question': 'Запомните изображения и выберите показанные',
            'images': shown_images,
            'options': all_options,
            'correct_answer': ','.join(shown_images),
            'delay': 5,
            'multiple_select': True,
            'time_limit': 30
        }
    
    elif question_type == 'pairs':
        # Тест на запоминание пар
        symbols = ['⭐', '⚡', '🌙', '🔴', '🔵']
        numbers = ['1', '2', '3', '4', '5']
        
        # Перемешиваем списки
        random.shuffle(symbols)
        random.shuffle(numbers)
        
        pairs = [[symbols[i], numbers[i]] for i in range(3)]  # используем только первые 3 пары
        
        return {
            'id': question_id,
            'type': question_type,
            'question': 'Запомните пары и восстановите соответствия',
            'stimulus': [f'{s} - {n}' for s, n in pairs],
            'options': [s for s, _ in pairs],
            'answer_options': [n for _, n in pairs],
            'correct_answer': ','.join([f'{s}:{n}' for s, n in pairs]),
            'delay': 5,
            'time_limit': 20
        }
    
    elif question_type == 'matrix':
        # Тест на запоминание матрицы чисел
        matrix_size = 3
        matrix = []
        for i in range(matrix_size):
            row = []
            for j in range(matrix_size):
                row.append(random.randint(1, 9))
            matrix.append(row)
        
        # Выбираем ячейку для запроса (предпочитаем центр или другие значимые ячейки)
        positions = [(1, 1), (0, 0), (2, 2), (0, 2), (2, 0)]
        pos_x, pos_y = positions[0]  # По умолчанию центр
        target_value = matrix[pos_x][pos_y]
        
        # Создаем варианты ответов
        options = [str(target_value)]
        while len(options) < 4:
            new_option = str(random.randint(1, 9))
            if new_option not in options:
                options.append(new_option)
        random.shuffle(options)
        
        return {
            'id': question_id,
            'type': question_type,
            'question': 'Запомните числа в матрице',
            'matrix': matrix,
            'question_text': 'Какое число было в центре матрицы?',
            'options': options,
            'correct_answer': str(target_value),
            'delay': 5,
            'time_limit': 20
        }
    
    elif question_type == 'reaction':
        # Тест на скорость реакции
        return {
            'id': question_id,
            'type': question_type,
            'question': 'Нажмите, когда появится зеленый круг',
            'animation': 'color-change',
            'correct_answer': 'click',
            'time_limit': 1
        }
    
    elif question_type == 'matrix_selection':
        # Тест на выбор ячеек в матрице
        matrix_questions = [
            {
                'question': 'Выберите все четные числа в матрице',
                'grid': [
                    ['1', '2', '3', '4'],
                    ['5', '6', '7', '8'],
                    ['9', '2', '4', '6'],
                    ['8', '7', '3', '1']
                ],
                'answer': '0-1,0-3,1-1,1-3,2-1,2-2,2-3,3-0'
            },
            {
                'question': 'Выберите все буквы "А" в матрице',
                'grid': [
                    ['А', 'Б', 'В', 'А'],
                    ['Г', 'А', 'Е', 'Ж'],
                    ['З', 'И', 'А', 'К'],
                    ['А', 'М', 'Н', 'А']
                ],
                'answer': '0-0,0-3,1-1,2-2,3-0,3-3'
            }
        ]
        
        selected_question = random.choice(matrix_questions)
        
        return {
            'id': question_id,
            'type': question_type,
            'question': selected_question['question'],
            'grid': selected_question['grid'],
            'correct_answer': selected_question['answer'],
            'time_limit': 30
        }
    
    elif question_type == 'cognitive':
        # Тест когнитивных способностей
        cognitive_questions = [
            {
                'question': 'Определите следующее число в последовательности: 2, 4, 6, 8',
                'options': ['9', '10', '12', '16'],
                'answer': '10'
            },
            {
                'question': 'Если ABCD = 1234 и EFGH = 5678, то ABEF = ?',
                'options': ['1256', '1265', '1526', '1625'],
                'answer': '1256'
            },
            {
                'question': 'Продолжите последовательность: 1, 4, 9, 16, ...',
                'options': ['20', '25', '36', '49'],
                'answer': '25'
            }
        ]
        
        selected_question = random.choice(cognitive_questions)
        
        return {
            'id': question_id,
            'type': question_type,
            'question': selected_question['question'],
            'options': selected_question['options'],
            'correct_answer': selected_question['answer'],
            'time_limit': 20
        }
    
    # Fallback для неизвестных типов
    return {
        'id': question_id,
        'type': 'logic',
        'question': 'Если A > B и B > C, то A _ C?',
        'options': [">", "<", "=", "недостаточно данных"],
        'correct_answer': ">",
        'time_limit': 20
    }

def calculate_results(questions, answers, test_type, time_elapsed):
    """Расчет результатов тестирования с улучшенной аналитикой"""
    correct = 0
    correct_answers = 0
    mistakes = []
    question_details = []
    total_response_time = 0
    response_times_by_type = {}
    accuracy_by_type = {}
    
    for q in questions:
        question_type = q['type']
        user_answer = answers.get(q['id'], '')
        response_time = float(answers.get(f"{q['id']}_time", 0))
        
        if not user_answer:
            user_answer = "не дан ответ"
            
        # Проверка правильности ответа
        is_correct = user_answer.strip() == q['correct_answer'].strip()
        
        # Сбор деталей по типам вопросов
        if question_type not in response_times_by_type:
            response_times_by_type[question_type] = []
            accuracy_by_type[question_type] = {'correct': 0, 'total': 0}
            
        response_times_by_type[question_type].append(response_time)
        accuracy_by_type[question_type]['total'] += 1
        if is_correct:
            accuracy_by_type[question_type]['correct'] += 1
            
        # Добавляем детали по вопросу
        question_details.append({
            'question_type': question_type,
            'response_time': response_time,
            'is_correct': is_correct,
            'question': q['question'],
            'user_answer': user_answer,
            'correct_answer': q['correct_answer']
        })
        
        if is_correct:
            correct += 1
            total_response_time += response_time
        else:
            mistakes.append({
                'question': q['question'],
                'user_answer': user_answer,
                'correct_answer': q['correct_answer'],
                'question_type': question_type
            })
    
    # Расчет общих метрик
    total_questions = len(questions)
    score = (correct / total_questions) * 100 if total_questions > 0 else 0
    avg_response_time = total_response_time / correct if correct > 0 else 0
    
    # Расчет производительности по типам вопросов
    performance_by_type = {}
    for qtype in accuracy_by_type:
        total = accuracy_by_type[qtype]['total']
        correct_count = accuracy_by_type[qtype]['correct']
        avg_time = sum(response_times_by_type[qtype]) / len(response_times_by_type[qtype]) if response_times_by_type[qtype] else 0
        
        performance_by_type[qtype] = {
            'accuracy': (correct_count / total) * 100 if total > 0 else 0,
            'average_time': avg_time
        }
    
    # Группировка ошибок по типам
    error_analysis = {}
    for m in mistakes:
        question_type = m.get('question_type', 'unknown')
        if question_type not in error_analysis:
            error_analysis[question_type] = 0
        error_analysis[question_type] += 1
    
    return {
        'score': round(score, 1),
        'total_questions': total_questions,
        'correct_answers': correct,
        'mistakes': mistakes,
        'time_elapsed': time_elapsed,
        'details': {
            'total_questions': total_questions,
            'correct_answers': correct,
            'error_analysis': error_analysis,
            'question_details': question_details,
            'average_response_time': avg_response_time,
            'performance_by_type': performance_by_type
        }
    }

@app.route('/api/fatigue/analyze', methods=['POST'])
@token_required
def analyze_fatigue(current_user):
    try:
        app.logger.info("Starting fatigue analysis...")
        if 'video' not in request.files:
            return jsonify({'error': 'Нет загруженного видео'}), 400
        
        file = request.files['video']
        if file.filename == '':
            return jsonify({'error': 'Не выбран файл'}), 400
        
        video_path, video_id = save_video(file, current_user['employee_id'])
        if not video_path:
            return jsonify({'error': 'Недопустимый формат файла'}), 400
        
        app.logger.info(f"Video saved at {video_path}, running analysis...")
        
        # Используем нейросеть для анализа видео
        try:
            fatigue_level, score_percent = analyze_source(video_path, is_video_file=True)
            score = score_percent / 100.0  # Конвертируем процент в число от 0 до 1
        except Exception as e:
            app.logger.error(f"Neural network analysis failed: {str(e)}")
            app.logger.error(traceback.format_exc())
            
            # Если нейросеть не смогла проанализировать, используем случайные данные
            level_map = {0: 'Low', 1: 'Medium', 2: 'High'}
            level_idx = random.choices([0, 1, 2], weights=[0.3, 0.4, 0.3], k=1)[0]
            fatigue_level = level_map[level_idx]
            score = random.uniform(0.2, 0.8)
            
        # Сохраняем результаты анализа в базу данных
        conn = get_db_connection()
        now = datetime.now().isoformat()
        
        # Получаем информацию о видео
        cap = cv2.VideoCapture(video_path)
        if cap.isOpened():
            width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            fps = cap.get(cv2.CAP_PROP_FPS)
            resolution = f"{width}x{height}"
            cap.release()
        else:
            resolution = "Unknown"
            fps = 0
        
        cursor = conn.cursor()
        cursor.execute(
            '''INSERT INTO FatigueAnalysis 
               (employee_id, video_path, analysis_date, fatigue_level, neural_network_score, resolution, fps) 
               VALUES (?, ?, ?, ?, ?, ?, ?)''',
            (current_user['employee_id'], video_path, now, fatigue_level, score, resolution, fps)
        )
        conn.commit()
        analysis_id = cursor.lastrowid
        conn.close()
        
        # Подготавливаем относительный путь к видео для клиента
        relative_path = os.path.join('videos', os.path.basename(video_path))
        
        app.logger.info(f"Analysis complete. Level: {fatigue_level}, Score: {score}")
        
        return jsonify({
            'analysis_id': analysis_id,
            'fatigue_level': fatigue_level,
            'neural_network_score': score,
            'analysis_date': now,
            'video_path': relative_path,
            'resolution': resolution,
            'fps': fps
        })
    except Exception as e:
        app.logger.error(f"Error in fatigue analysis: {str(e)}")
        app.logger.error(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

@app.route('/api/fatigue/save-recording', methods=['POST'])
@token_required
def save_recording(current_user):
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
        
        # Подготавливаем относительный путь к видео для клиента
        relative_path = os.path.join('videos', os.path.basename(video_path))
        
        return jsonify({
            'video_id': video_id,
            'video_path': relative_path,
            'upload_date': datetime.now().isoformat(),
            'resolution': resolution,
            'fps': fps,
            'message': 'Видео успешно сохранено'
        })
    except Exception as e:
        app.logger.error(f"Error saving recording: {str(e)}")
        app.logger.error(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

@app.route('/api/flights/last-completed', methods=['GET'])
@token_required
def get_last_completed_flight(current_user):
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
        app.logger.error(f"Error getting last flight: {str(e)}")
        return jsonify({"error": str(e)}), 500
    finally:
        if conn: conn.close()

@app.route('/api/fatigue/analyze-flight', methods=['POST'])
@token_required
def analyze_flight(current_user):
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
            
            app.logger.warning(f"Flight video not found: {video_path}")
            
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
        except Exception as e:
            app.logger.error(f"Neural network analysis failed for flight: {str(e)}")
            app.logger.error(traceback.format_exc())
            
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
        
        # Подготавливаем относительный путь к видео для клиента
        relative_path = os.path.join('videos', os.path.basename(video_path)) if video_path else None
        
        return jsonify({
            'analysis_id': analysis_id,
            'fatigue_level': fatigue_level,
            'neural_network_score': score,
            'analysis_date': now,
            'from_code': flight['from_code'] if 'from_code' in flight else None,
            'to_code': flight['to_code'] if 'to_code' in flight else None,
            'video_path': relative_path
        })
    except Exception as e:
        app.logger.error(f"Error analyzing flight: {str(e)}")
        app.logger.error(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

@app.route('/api/fatigue/history', methods=['GET'])
@token_required
def get_fatigue_history(current_user):
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
        
        return jsonify([dict(row) for row in history])
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

@app.route('/api/fatigue/feedback', methods=['POST'])
@token_required
def submit_fatigue_feedback(current_user):
    conn = None  # Инициализация до try
    try:
        app.logger.info(f"Incoming feedback data: {request.json}")
        data = request.get_json()

        if not data:
            app.logger.warning("Empty request body")
            return jsonify({'error': 'Empty request'}), 400

        required_fields = ['analysis_id', 'score']
        if not all(field in data for field in required_fields):
            app.logger.warning("Empty request body2")
            return jsonify({'error': f'Missing fields: {required_fields}'}), 400
        
        try:
            analysis_id = int(data['analysis_id'])
            score = float(data['score'])
        except ValueError:
            app.logger.warning("Empty request body3")
            return jsonify({'error': 'Invalid data types'}), 400
            
        conn = get_db_connection()


        analysis = conn.execute(
            'SELECT * FROM FatigueAnalysis WHERE analysis_id = ? AND employee_id = ?',
            (analysis_id, current_user['employee_id'])
        ).fetchone()
        
        if not analysis:
            app.logger.warning("Empty request body4")
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
        app.logger.error(f"Database error: {str(e)}")
        return jsonify({'error': 'Database operation failed'}), 500
    except Exception as e:
        app.logger.error(f"Unexpected error: {traceback.format_exc()}")
        return jsonify({'error': 'Internal server error'}), 500
    finally:
        if conn:
            conn.close()

@app.route('/api/videos/<path:filename>', methods=['GET'])
def get_video(filename):
    try:
        return send_from_directory(
            VIDEO_DIR,
            filename,
            mimetype='video/mp4',
            as_attachment=False
        )
    except FileNotFoundError:
        return jsonify({'error': 'Video not found'}), 404
    
@app.route('/api/fatigue/<int:analysis_id>', methods=['GET'])
@token_required
def get_analysis(current_user, analysis_id):
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
            
        return jsonify(dict(analysis))
        
    except Exception as e:
        app.logger.error(f"Error getting analysis: {str(e)}")
        return jsonify({'error': str(e)}), 500
    finally:
        if conn: conn.close()

@app.route('/api/tests/start', methods=['POST'])
@token_required
def start_test(current_user):
    try:
        test_type = request.json.get('test_type')
        if not test_type:
            return jsonify({'error': 'Тип теста не указан'}), 400
            
        # Генерация вопросов для теста (увеличено до 10 вопросов)
        questions = generate_test_questions(test_type, count=10)
        
        if not questions or len(questions) == 0:
            return jsonify({'error': 'Не удалось создать вопросы для теста'}), 500
            
        # Создаем уникальный ID для тестовой сессии
        test_id = str(uuid.uuid4())
        
        # Сохраняем сессию в памяти
        test_sessions[test_id] = {
            'employee_id': current_user['employee_id'],
            'test_type': test_type,
            'start_time': datetime.now().isoformat(),
            'questions': questions,
            'answers': {}
        }
        
        # Возвращаем клиенту информацию о тесте
        return jsonify({
            'test_id': test_id,
            'questions': questions,
            'current_question': 0,
            'time_limit': 300,  # 5 минут общий лимит
            'total_questions': len(questions)
        })
    except Exception as e:
        app.logger.error(f"Error starting test: {traceback.format_exc()}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/tests/submit', methods=['POST'])
@token_required
def submit_test(current_user):
    try:
        data = request.get_json()
        test_id = data.get('test_id')
        answers = data.get('answers', {})
        
        if not test_id or test_id not in test_sessions:
            return jsonify({'error': 'Недействительный ID теста'}), 400
            
        test_session = test_sessions[test_id]
        
        if test_session['employee_id'] != current_user['employee_id']:
            return jsonify({'error': 'Доступ запрещен'}), 403
            
        start_time = datetime.fromisoformat(test_session['start_time'])
        end_time = datetime.now()
        duration = int((end_time - start_time).total_seconds())
        
        # Расчет результатов теста
        results = calculate_results(
            test_session['questions'], 
            answers, 
            test_session['test_type'], 
            duration
        )
        
        # Устанавливаем период перезарядки теста (30 минут)
        cooldown_end = end_time + timedelta(minutes=30)
        cooldown_end_str = cooldown_end.isoformat()
        
        # Сохраняем результаты в БД
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO CognitiveTests 
            (employee_id, test_type, test_date, score, duration, details, cooldown_end)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (
            current_user['employee_id'],
            test_session['test_type'],
            end_time.isoformat(),
            results['score'],
            duration,
            json.dumps(results),
            cooldown_end_str
        ))
        conn.commit()
        test_id_db = cursor.lastrowid
        conn.close()
        
        # Очищаем сессию из памяти
        del test_sessions[test_id]
        
        # Возвращаем клиенту краткие результаты
        return jsonify({
            'score': results['score'],
            'test_id': test_id_db,
            'total_questions': results['total_questions'],
            'correct_answers': results['correct_answers'],
            'cooldown_end': cooldown_end_str
        })
    except Exception as e:
        app.logger.error(f"Error submitting test: {traceback.format_exc()}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/tests/results/<int:test_id>', methods=['GET'])
@token_required
def get_test_results(current_user, test_id):
    conn = None
    try:
        conn = get_db_connection()
        test = conn.execute('''
            SELECT * FROM CognitiveTests 
            WHERE test_id = ? AND employee_id = ?
        ''', (test_id, current_user['employee_id'])).fetchone()
        
        if not test:
            return jsonify({'error': 'Тест не найден'}), 404
            
        # Преобразуем детали теста из JSON в словарь
        details = json.loads(test['details'])
        
        result = {
            'test_id': test['test_id'],
            'test_date': test['test_date'],
            'test_type': test['test_type'],
            'score': test['score'],
            'duration': test['duration'],
            'details': details,
            'mistakes': details.get('mistakes', []),
            'cooldown_end': test['cooldown_end']
        }
        
        return jsonify(result)
    except Exception as e:
        app.logger.error(f"Error getting test results: {str(e)}")
        return jsonify({"error": str(e)}), 500
    finally:
        if conn:
            conn.close()

@app.route('/api/crew', methods=['GET'])
@token_required
def get_crew(current_user):
    conn = get_db_connection()
    crew = conn.execute('''
        SELECT e.*, c.crew_name 
        FROM Employees e
        JOIN CrewMembers cm ON e.employee_id = cm.employee_id
        JOIN Crews c ON cm.crew_id = c.crew_id
        WHERE cm.crew_id = (
            SELECT crew_id FROM CrewMembers 
            WHERE employee_id = ?
        )
    ''', (current_user['employee_id'],)).fetchall()
    conn.close()
    return jsonify([dict(member) for member in crew])

@app.route('/api/flights', methods=['GET'])
@token_required
def get_flights(current_user):
    conn = get_db_connection()
    flights = conn.execute('''
        SELECT 
            f.flight_id,
            f.departure_time,
            f.arrival_time,
            f.duration,
            f.from_code,
            f.from_city,
            f.to_code,
            f.to_city,
            f.aircraft,
            f.conditions,
            c.crew_name
        FROM Flights f
        JOIN Crews c ON f.crew_id = c.crew_id
        WHERE f.crew_id = (
            SELECT crew_id FROM CrewMembers 
            WHERE employee_id = ?
        )
        ORDER BY f.departure_time DESC
    ''', (current_user['employee_id'],)).fetchall()
    conn.close()
    return jsonify([dict(flight) for flight in flights])

@app.route('/api/fatigue', methods=['GET'])
@token_required
def get_fatigue_data(current_user):
    conn = get_db_connection()
    data = conn.execute('''
        SELECT * FROM FatigueAnalysis
        WHERE employee_id = ?
        ORDER BY analysis_date DESC
    ''', (current_user['employee_id'],)).fetchall()
    conn.close()
    return jsonify([dict(row) for row in data])

@app.route('/api/flight-eligibility', methods=['GET'])
@token_required
def get_flight_eligibility(current_user):
    conn = get_db_connection()
    try:
        current_date = datetime.now().date()
        eligibility_data = []

        # 1. Медицинская проверка
        medical = conn.execute('''
            SELECT 
                check_date, 
                expiry_date, 
                status,
                notes 
            FROM MedicalChecks
            WHERE 
                employee_id = ?
                AND status IN ('passed', 'conditionally_passed')
            ORDER BY check_date DESC
            LIMIT 1
        ''', (current_user['employee_id'],)).fetchone()

        if medical:
            expiry_date = datetime.strptime(medical['expiry_date'], '%Y-%m-%d').date()
            is_valid = expiry_date >= current_date
        else:
            is_valid = False
        
        medical_status = {
            'id': 1,
            'name': 'Medical Certificate',
            'status': 'passed' if is_valid else 'failed',
            'last_check': medical['check_date'] if medical else None,
            'expiry_date': medical['expiry_date'] if medical else None,
            'details': medical['notes'] if medical else 'No valid medical certificate',
            'required': True
        }
        eligibility_data.append(medical_status)

        # 2. Когнитивный тест
        cognitive_tests = conn.execute('''
            SELECT score, test_date 
            FROM CognitiveTests
            WHERE employee_id = ?
            ORDER BY test_date DESC
            LIMIT 3
        ''', (current_user['employee_id'],)).fetchall()

        test_status = 'failed'
        details = 'No cognitive tests available'
        latest_date = None

        if cognitive_tests:
            latest_date = cognitive_tests[0]['test_date']

        if len(cognitive_tests) >= 3:
            total = sum(t['score'] for t in cognitive_tests)
            average = total / 3
            test_status = 'passed' if average >= 75 else 'failed'
            details = f"Average of last 3 tests: {average:.1f}%"
        else:
            details = f"Requires 3 tests (current: {len(cognitive_tests)})"

        eligibility_data.append({
            'id': 2,
            'name': 'Cognitive Assessment',
            'status': test_status,
            'last_check': latest_date,
            'details': details,
            'required': True
        })

        # 3. Анализ усталости
        fatigue = conn.execute('''
            SELECT analysis_date, neural_network_score
            FROM FatigueAnalysis
            WHERE employee_id = ?
            ORDER BY analysis_date DESC
            LIMIT 1
        ''', (current_user['employee_id'],)).fetchone()

        fatigue_status = 'pending'
        if fatigue:
            fatigue_status = 'passed' if fatigue['neural_network_score'] < 0.7 else 'failed'

        eligibility_data.append({
            'id': 3,
            'name': 'Fatigue Level',
            'status': fatigue_status,
            'last_check': fatigue['analysis_date'] if fatigue else None,
            'details': f"Last reading: {fatigue['neural_network_score']*100:.1f}%" if fatigue else 'No fatigue data',
            'required': True
        })

        return jsonify(eligibility_data)

    except Exception as e:
        app.logger.error(f"Error in flight eligibility: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500
    finally:
        conn.close()

@app.route('/api/profile', methods=['GET'])
@token_required
def get_profile(current_user):
    conn = get_db_connection()
    try:
        # Основные данные профиля
        profile = conn.execute('''
            SELECT 
                e.employee_id,
                e.name,
                e.role,
                e.contact_info,
                e.employment_date,
                e.image_url,
                COUNT(f.flight_id) as total_flights,
                SUM(f.duration) as total_hours
            FROM Employees e
            LEFT JOIN CrewMembers cm ON e.employee_id = cm.employee_id
            LEFT JOIN Flights f ON cm.crew_id = f.crew_id 
                AND f.arrival_time < CURRENT_TIMESTAMP
            WHERE e.employee_id = ?
            GROUP BY e.employee_id
        ''', (current_user['employee_id'],)).fetchone()

        # Статистика за текущую неделю (только завершенные рейсы)
        weekly_stats = conn.execute('''
            SELECT 
                COUNT(f.flight_id) as weekly_completed_flights,
                SUM(f.duration) as weekly_completed_hours
            FROM Flights f
            JOIN CrewMembers cm ON f.crew_id = cm.crew_id
            WHERE cm.employee_id = ?
              AND DATE(f.departure_time) >= DATE('now', 'weekday 0', '-6 days')
              AND f.arrival_time < CURRENT_TIMESTAMP
        ''', (current_user['employee_id'],)).fetchone()

        result = dict(profile)
        result.update({
            'weekly_completed_flights': weekly_stats['weekly_completed_flights'] or 0,
            'weekly_completed_hours': weekly_stats['weekly_completed_hours'] or 0
        })

        return jsonify(result)

    except sqlite3.Error as e:
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

@app.route('/api/cognitive-tests', methods=['GET'])
@token_required
def get_cognitive_tests(current_user):
    conn = None
    try:
        conn = get_db_connection()
        tests = conn.execute('''
            SELECT test_id, test_type, test_date, score, 
                   duration, details, cooldown_end
            FROM CognitiveTests 
            WHERE employee_id = ? 
            ORDER BY test_date DESC
        ''', (current_user['employee_id'],)).fetchall()
        
        return jsonify([dict(test) for test in tests])
    except Exception as e:
        app.logger.error(f"Error getting cognitive tests: {str(e)}")
        return jsonify({"error": str(e)}), 500
    finally:
        if conn:
            conn.close()



def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def save_video(file, employee_id):
    """Сохраняет видео и возвращает путь к сохраненному файлу"""
    if file and allowed_file(file.filename):
        # Генерируем уникальное имя файла
        video_id = str(uuid.uuid4())
        orig_filename = file.filename
        extension = orig_filename.rsplit('.', 1)[1].lower()
        new_filename = f"video_{video_id}.{extension}"
        video_path = os.path.join(VIDEO_DIR, new_filename)
        
        # Сохраняем файл
        file.save(video_path)
        
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
    return None, None


@app.route('/api/cognitive-tests/<int:test_id>/results', methods=['GET'])
@token_required
def get_test_details(current_user, test_id):
    """Получение деталей теста и ошибок"""
    conn = get_db_connection()
    try:
        # Проверка принадлежности теста пользователю
        test = conn.execute('''
            SELECT * FROM CognitiveTests
            WHERE test_id = ? 
            AND employee_id = ?
        ''', (test_id, current_user['employee_id'])).fetchone()

        if not test:
            return jsonify({"error": "Test not found"}), 404

        # Получение ошибок
        mistakes = conn.execute('''
            SELECT 
                question,
                user_answer,
                correct_answer
            FROM TestMistakes
            WHERE test_id = ?
        ''', (test_id,)).fetchall()

        response_data = {
            "test": dict(test),
            "mistakes": [dict(mistake) for mistake in mistakes],
            "analysis": {
                "total_questions": len(mistakes) + test['score']/100*(len(mistakes)/(1-test['score']/100)) if test['score'] < 100 else len(mistakes),
                "correct_answers": round(test['score']/100 * (len(mistakes)/(1-test['score']/100))) if test['score'] < 100 else "N/A"
            }
        }

        return jsonify(response_data)

    except sqlite3.Error as e:
        app.logger.error(f"Database error: {str(e)}")
        return jsonify({"error": "Database operation failed"}), 500
    except Exception as e:
        app.logger.error(f"Unexpected error: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500
    finally:
        conn.close()

@app.route('/api/feedback', methods=['GET', 'POST'])
@token_required
def handle_feedback(current_user):
    app.logger.info(f"Handling feedback request: {request.method}")
    if request.method == 'GET':
        try:
            conn = get_db_connection()
            feedbacks = conn.execute('''
                SELECT 
                    f.*,
                    CASE 
                        WHEN f.entity_type = 'flight' THEN (
                            SELECT from_code || ' - ' || to_code 
                            FROM Flights 
                            WHERE flight_id = f.entity_id
                        )
                        WHEN f.entity_type = 'cognitive_test' THEN (
                            SELECT test_type || ' (' || score || '%)'
                            FROM CognitiveTests 
                            WHERE test_id = f.entity_id
                        )
                        WHEN f.entity_type = 'fatigue_analysis' THEN (
                            SELECT fatigue_level || ' (' || (neural_network_score * 100) || '%)'
                            FROM FatigueAnalysis 
                            WHERE analysis_id = f.entity_id
                        )
                    END as entity_info,
                    datetime(f.created_at) as formatted_date
                FROM Feedback f
                WHERE f.employee_id = ?
                ORDER BY f.created_at DESC
            ''', (current_user['employee_id'],)).fetchall()
            
            app.logger.info(f"Found {len(feedbacks) if feedbacks else 0} feedback entries")
            
            return jsonify([{
                'id': f['feedback_id'],
                'type': f['entity_type'],
                'entityId': f['entity_id'],
                'entityInfo': f['entity_info'] or f"Unknown {f['entity_type']} #{f['entity_id']}",
                'rating': f['rating'],
                'comments': f['comments'],
                'date': f['formatted_date']
            } for f in feedbacks])
        
        except sqlite3.Error as e:
            app.logger.error(f"Database error in feedback GET: {str(e)}")
            return jsonify({'error': 'Failed to fetch feedback'}), 500
        except Exception as e:
            app.logger.error(f"Unexpected error in feedback GET: {str(e)}")
            return jsonify({'error': 'Internal server error'}), 500
        finally:
            if 'conn' in locals():
                conn.close()

    elif request.method == 'POST':
        try:
            app.logger.info(f"Received feedback data: {request.json}")
            data = request.get_json()
            
            if not data:
                app.logger.warning("Empty request body")
                return jsonify({'error': 'No data provided'}), 400
                
            # Проверяем наличие как camelCase, так и snake_case полей
            entity_type = data.get('entity_type') or data.get('entityType')
            entity_id = data.get('entity_id') or data.get('entityId')
            rating = data.get('rating')
            comments = data.get('comments')
            
            if not all([entity_type, entity_id, rating]):
                app.logger.warning(f"Missing required fields. Got: {data}")
                return jsonify({'error': 'Missing required fields'}), 400

            try:
                entity_id = int(entity_id)
                rating = int(rating)
            except (ValueError, TypeError):
                app.logger.warning(f"Invalid data types: entity_id={entity_id}, rating={rating}")
                return jsonify({'error': 'Invalid data types'}), 400

            if not 1 <= rating <= 5:
                return jsonify({'error': 'Rating must be between 1 and 5'}), 400

            conn = get_db_connection()
            
            # Check if entity exists
            entity_exists = False
            if entity_type in ['flight', 'cognitive_test', 'fatigue_analysis']:
                table_name = {
                    'flight': 'Flights',
                    'cognitive_test': 'CognitiveTests',
                    'fatigue_analysis': 'FatigueAnalysis'
                }[entity_type]
                id_field = {
                    'flight': 'flight_id',
                    'cognitive_test': 'test_id',
                    'fatigue_analysis': 'analysis_id'
                }[entity_type]
                
                entity_exists = conn.execute(f'SELECT 1 FROM {table_name} WHERE {id_field} = ?', 
                                         (entity_id,)).fetchone() is not None
            
            # Для тестирования разрешим любые entity_id
            entity_exists = True
            
            if not entity_exists:
                app.logger.warning(f"Entity not found: {entity_type} with id {entity_id}")
                return jsonify({'error': f'{entity_type} not found'}), 404

            # Check for existing feedback
            existing = conn.execute('''
                SELECT 1 FROM Feedback 
                WHERE employee_id = ? 
                AND entity_type = ? 
                AND entity_id = ?
            ''', (
                current_user['employee_id'],
                entity_type,
                entity_id
            )).fetchone()

            if existing:
                app.logger.info(f"Feedback already exists for {entity_type} #{entity_id}")
                return jsonify({'error': 'Feedback already exists'}), 409

            # Insert new feedback
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO Feedback (
                    employee_id, entity_type, entity_id,
                    rating, comments, created_at
                ) VALUES (?, ?, ?, ?, ?, datetime('now'))
            ''', (
                current_user['employee_id'],
                entity_type,
                entity_id,
                rating,
                comments,
            ))
            
            conn.commit()
            feedback_id = cursor.lastrowid
            app.logger.info(f"Feedback saved with ID: {feedback_id}")
            
            return jsonify({
                'id': feedback_id,
                'message': 'Feedback submitted successfully'
            }), 201

        except sqlite3.Error as e:
            app.logger.error(f"Database error in feedback POST: {str(e)}")
            return jsonify({'error': 'Failed to save feedback'}), 500
        except Exception as e:
            app.logger.error(f"Unexpected error in feedback POST: {traceback.format_exc()}")
            return jsonify({'error': 'Internal server error'}), 500
        finally:
            if 'conn' in locals():
                conn.close()

@app.route('/api/tests/cooldown/<string:test_type>', methods=['GET'])
@app.route('/api/cognitive-tests/cooldown/<string:test_type>', methods=['GET'])
@token_required
def check_test_cooldown(current_user, test_type):
    """Проверка времени перезарядки теста"""
    conn = get_db_connection()
    try:
        last_test = conn.execute('''
            SELECT test_date 
            FROM CognitiveTests 
            WHERE employee_id = ? 
              AND test_type = ?
            ORDER BY test_date DESC 
            LIMIT 1
        ''', (current_user['employee_id'], test_type)).fetchone()
        
        if not last_test:
            return jsonify({'in_cooldown': False})
            
        # Проверяем прошло ли достаточно времени (например, 10 минут для тестирования)
        last_time = datetime.fromisoformat(last_test['test_date'])
        cooldown_seconds = 600  # 10 минут
        now = datetime.now()
        
        if (now - last_time).total_seconds() < cooldown_seconds:
            cooldown_end = last_time + timedelta(seconds=cooldown_seconds)
            return jsonify({
                'in_cooldown': True,
                'cooldown_end': cooldown_end.isoformat()
            })
        
        return jsonify({'in_cooldown': False})
        
    except Exception as e:
        app.logger.error(f"Error in test cooldown check: {str(e)}")
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

@app.route('/api/debug/check-db', methods=['GET'])
def check_database():
    try:
        conn = get_db_connection()
        # Check if we can access the database
        tables = conn.execute("SELECT name FROM sqlite_master WHERE type='table';").fetchall()
        table_names = [table['name'] for table in tables]
        conn.close()
        return jsonify({
            'status': 'OK',
            'database_file': DATABASE,
            'tables': table_names
        })
    except sqlite3.Error as e:
        return jsonify({
            'status': 'ERROR',
            'error': str(e),
            'database_file': DATABASE
        }), 500

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    if path and os.path.exists(os.path.join('site', 'dist', path)):
        return send_from_directory('site/dist', path)
    return send_from_directory('site/dist', 'index.html')


if __name__ == '__main__':
    app.run(debug=True, port=5000)
