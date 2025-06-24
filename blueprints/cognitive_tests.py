import json
import sqlite3
import random
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify, g
from functools import wraps

cognitive_tests_bp = Blueprint('cognitive_tests', __name__)

def auth_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not hasattr(g, 'user') or g.user is None:
            return jsonify({'error': 'Authentication required'}), 401
        return f(*args, **kwargs)
    return decorated_function

def get_db_connection():
    conn = sqlite3.connect('database/database.db')
    conn.row_factory = sqlite3.Row
    return conn

@cognitive_tests_bp.route('/api/cognitive-tests/start/<test_type>', methods=['POST'])
@auth_required
def start_test(test_type):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Проверяем период перезарядки (изменено с 30 на 5 минут)
        cooldown_check = cursor.execute("""
            SELECT test_date, score FROM CognitiveTests 
            WHERE employee_id = ? AND test_type = ? 
            ORDER BY test_date DESC LIMIT 1
        """, (g.user['employee_id'], test_type)).fetchone()
        
        if cooldown_check:
            last_test_time = datetime.fromisoformat(cooldown_check['test_date'])
            cooldown_end = last_test_time + timedelta(minutes=5)  # Изменено с 30 на 5 минут
            
            if datetime.now() < cooldown_end:
                return jsonify({
                    'error': f'Тест будет доступен через {int((cooldown_end - datetime.now()).total_seconds() / 60)} мин.',
                    'in_cooldown': True,
                    'cooldown_end': cooldown_end.isoformat()
                }), 429

        # Загрузка вопросов из JSON
        with open(f'database/questions/{test_type}_questions.json', 'r', encoding='utf-8') as f:
            questions = json.load(f)
        
        # Выбор случайных вопросов
        num_questions = min(10, len(questions))
        selected_questions = random.sample(questions, num_questions)
        
        # Определение времени на тест (в секундах)
        time_limit = num_questions * 30  # 30 секунд на вопрос
        
        # Сохранение сессии теста в базе данных
        cursor.execute("""
            INSERT INTO TestSessions (employee_id, test_type, start_time, questions)
            VALUES (?, ?, ?, ?)
        """, (g.user['employee_id'], test_type, datetime.now().isoformat(), json.dumps([q['id'] for q in selected_questions])))
        session_id = cursor.lastrowid
        conn.commit()
        
        # Форматирование данных для ответа
        session_data = {
            'session_id': session_id,
            'test_id': test_type,
            'time_limit': time_limit,
            'questions': selected_questions
        }
        
        conn.close()
        return jsonify(session_data)
        
    except Exception as e:
        print(f"Ошибка при начале теста: {str(e)}")
        return jsonify({'error': 'Ошибка сервера'}), 500

@cognitive_tests_bp.route('/api/cognitive-tests/cooldown/<test_type>', methods=['GET'])
@auth_required  
def check_test_cooldown(test_type):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Проверяем последний тест (изменено с 30 на 5 минут)
        last_test = cursor.execute("""
            SELECT test_date FROM CognitiveTests 
            WHERE employee_id = ? AND test_type = ? 
            ORDER BY test_date DESC LIMIT 1
        """, (g.user['employee_id'], test_type)).fetchone()
        
        if last_test:
            last_test_time = datetime.fromisoformat(last_test['test_date'])
            cooldown_end = last_test_time + timedelta(minutes=5)  # Изменено с 30 на 5 минут
            
            if datetime.now() < cooldown_end:
                return jsonify({
                    'in_cooldown': True,
                    'cooldown_end': cooldown_end.isoformat()
                })
        
        return jsonify({'in_cooldown': False})
        
    except Exception as e:
        print(f"Ошибка при проверке cooldown: {str(e)}")
        return jsonify({'error': 'Ошибка сервера'}), 500

@cognitive_tests_bp.route('/api/cognitive-tests/submit/<test_id>', methods=['POST'])
@auth_required
def submit_test(test_id):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Получаем ответы из запроса
        answers = request.get_json()
        
        # Получаем детали сессии теста
        cursor.execute("""
            SELECT employee_id, questions FROM TestSessions 
            WHERE rowid = ?
        """, (test_id,))
        session_data = cursor.fetchone()
        
        if not session_data:
            return jsonify({'error': 'Сессия теста не найдена'}), 404
        
        employee_id = session_data['employee_id']
        question_ids = json.loads(session_data['questions'])
        
        # Загружаем вопросы из JSON
        test_type = cursor.execute("SELECT test_type FROM TestSessions WHERE rowid = ?", (test_id,)).fetchone()[0]
        with open(f'database/questions/{test_type}_questions.json', 'r', encoding='utf-8') as f:
            questions = json.load(f)
        
        # Подсчет правильных ответов
        correct_answers = 0
        mistakes = []
        for question_id in question_ids:
            question = next((q for q in questions if q['id'] == question_id), None)
            if question and question_id in answers:
                user_answer = answers[question_id]
                if 'answer' in question and str(user_answer).lower() == str(question['answer']).lower():
                    correct_answers += 1
                else:
                    mistakes.append({
                        'question': question['question'],
                        'user_answer': user_answer,
                        'correct_answer': question['answer'] if 'answer' in question else 'N/A'
                    })
        
        # Рассчитываем score
        total_questions = len(question_ids)
        score = int((correct_answers / total_questions) * 100)
        
        # Анализ ошибок по категориям (пример)
        error_analysis = {}
        for mistake in mistakes:
            question_type = mistake['question'].split()[0].lower()  # Очень упрощенный пример
            if question_type in error_analysis:
                error_analysis[question_type] += 1
            else:
                error_analysis[question_type] = 1
        
        # Сохраняем результаты теста в базе данных
        cursor.execute("""
            INSERT INTO CognitiveTests (employee_id, test_type, test_date, score, details)
            VALUES (?, ?, ?, ?, ?)
        """, (employee_id, test_type, datetime.now().isoformat(), score, json.dumps({
            'total_questions': total_questions,
            'correct_answers': correct_answers,
            'error_analysis': error_analysis
        })))
        conn.commit()
        
        # Возвращаем результаты
        return jsonify({
            'test_id': test_id,
            'score': score,
            'correct_answers': correct_answers,
            'total_questions': total_questions,
            'mistakes': mistakes
        })
        
    except Exception as e:
        print(f"Ошибка при отправке результатов теста: {str(e)}")
        return jsonify({'error': 'Ошибка сервера'}), 500

@cognitive_tests_bp.route('/api/cognitive-tests/history', methods=['GET'])
@auth_required
def get_test_history():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Получаем историю тестов для текущего пользователя
        cursor.execute("""
            SELECT rowid, test_type, test_date, score, details FROM CognitiveTests 
            WHERE employee_id = ?
            ORDER BY test_date DESC
        """, (g.user['employee_id'],))
        history = cursor.fetchall()
        
        # Преобразуем результаты в список словарей
        history_list = []
        for row in history:
            history_list.append({
                'test_id': row[0],
                'test_type': row[1],
                'test_date': row[2],
                'score': row[3],
                'details': json.loads(row[4]) if row[4] else {}
            })
        
        conn.close()
        return jsonify(history_list)
        
    except Exception as e:
        print(f"Ошибка при получении истории тестов: {str(e)}")
        return jsonify({'error': 'Ошибка сервера'}), 500

@cognitive_tests_bp.route('/api/cognitive-tests/results/<test_id>', methods=['GET'])
@auth_required
def get_test_results(test_id):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Получаем результаты теста по ID
        cursor.execute("""
            SELECT employee_id, test_type, test_date, score, details FROM CognitiveTests 
            WHERE rowid = ? AND employee_id = ?
        """, (test_id, g.user['employee_id']))
        result = cursor.fetchone()
        
        if not result:
            return jsonify({'error': 'Результаты теста не найдены'}), 404
        
        # Преобразуем результаты в словарь
        result_dict = {
            'test_id': test_id,
            'employee_id': result[0],
            'test_type': result[1],
            'test_date': result[2],
            'score': result[3],
            'details': json.loads(result[4]) if result[4] else {}
        }
        
        conn.close()
        return jsonify(result_dict)
        
    except Exception as e:
        print(f"Ошибка при получении результатов теста: {str(e)}")
        return jsonify({'error': 'Ошибка сервера'}), 500
