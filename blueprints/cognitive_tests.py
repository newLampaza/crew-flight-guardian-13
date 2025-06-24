from flask import Blueprint, request, jsonify
from database.init_db import get_db_connection
import json
from datetime import datetime, timedelta
import uuid

cognitive_tests_bp = Blueprint('cognitive_tests', __name__)

TEST_CONFIGURATIONS = {
    "attention": {
        "id": "attention",
        "name": "Тест на Внимание",
        "description": "Оцените свою способность концентрироваться и быстро реагировать на стимулы.",
        "timeLimit": 120,
        "questions": [
            {
                "id": "attention_1",
                "type": "difference",
                "question": "Найдите отличие на изображениях",
                "images": [
                    "https://picsum.photos/400/300",
                    "https://picsum.photos/400/301"
                ],
                "options": ["Слева", "Справа"],
                "answer": "Справа",
                "delay": 0
            },
            {
                "id": "attention_2",
                "type": "count",
                "question": "Сколько треугольников на картинке?",
                "grid": [
                    ["A", "B", "C"],
                    ["D", "E", "F"],
                    ["G", "H", "I"]
                ],
                "options": ["3", "4", "5", "6"],
                "answer": "5",
                "delay": 0
            },
            {
                "id": "attention_3",
                "type": "select",
                "question": "Выберите все красные объекты",
                "options": ["Яблоко", "Банан", "Груша", "Апельсин"],
                "answer": "Яблоко,Апельсин",
                "multiple_select": True,
                "delay": 5
            }
        ]
    },
    "memory": {
        "id": "memory",
        "name": "Тест на Память",
        "description": "Проверьте свою кратковременную память и способность к запоминанию.",
        "timeLimit": 120,
        "questions": [
            {
                "id": "memory_1",
                "type": "sequence",
                "question": "Запомните последовательность и повторите ее",
                "stimulus": ["A", "B", "C", "D"],
                "options": ["A", "B", "C", "D"],
                "answer": "A,B,C,D",
                "delay": 5
            },
            {
                "id": "memory_2",
                "type": "words",
                "question": "Запомните слова и выберите их из списка",
                "stimulus": ["Книга", "Ручка", "Стол"],
                "options": ["Книга", "Ручка", "Стол", "Стул"],
                "answer": "Книга,Ручка,Стол",
                "multiple_select": True,
                "delay": 5
            },
            {
                "id": "memory_3",
                "type": "images",
                "question": "Запомните изображения и выберите их из списка",
                "stimulus": [
                    "https://picsum.photos/100/100",
                    "https://picsum.photos/101/101"
                ],
                "options": [
                    "https://picsum.photos/100/100",
                    "https://picsum.photos/101/101",
                    "https://picsum.photos/102/102",
                    "https://picsum.photos/103/103"
                ],
                "answer": "https://picsum.photos/100/100,https://picsum.photos/101/101",
                "multiple_select": True,
                "delay": 5
            },
            {
                "id": "memory_4",
                "type": "pairs",
                "question": "Соотнесите пары",
                "options": ["Яблоко", "Банан", "Груша"],
                "answer_options": ["Красный", "Желтый", "Зеленый"],
                "answer": "Яблоко:Красный,Банан:Желтый,Груша:Зеленый",
                "delay": 5
            },
            {
                "id": "memory_5",
                "type": "matrix",
                "question": "Запомните матрицу и выберите правильный элемент",
                "matrix": [
                    ["A", "B", "C"],
                    ["D", "E", "F"],
                    ["G", "H", "I"]
                ],
                "question_text": "Какой элемент находится в центре матрицы?",
                "options": ["A", "B", "C", "D", "E", "F", "G", "H", "I"],
                "answer": "E",
                "delay": 5
            },
            {
                "id": "memory_6",
                "type": "memory",
                "question": "Запомните последовательность чисел",
                "stimulus": ["5", "2", "9", "1", "4"],
                "options": ["5,2,9,1,4", "4,1,9,2,5", "1,2,3,4,5", "5,4,3,2,1"],
                "answer": "5,2,9,1,4",
                "delay": 5
            }
        ]
    },
    "reaction": {
        "id": "reaction",
        "name": "Тест на Реакцию",
        "description": "Измерьте свою скорость реакции на внезапные стимулы.",
        "timeLimit": 60,
        "questions": [
            {
                "id": "reaction_1",
                "type": "reaction",
                "question": "Нажмите кнопку, когда она станет зеленой",
                "answer": "good_reaction",
                "delay": 0
            }
        ]
    },
    "cognitive": {
        "id": "cognitive",
        "name": "Когнитивный Тест",
        "description": "Оцените свои когнитивные способности и навыки решения задач.",
        "timeLimit": 180,
        "questions": [
            {
                "id": "cognitive_1",
                "type": "logic",
                "question": "Какое слово лишнее?",
                "options": ["Собака", "Кошка", "Стол", "Лошадь"],
                "answer": "Стол",
                "delay": 0
            },
            {
                "id": "cognitive_2",
                "type": "math",
                "question": "Решите пример: 2 + 2 * 2",
                "options": ["4", "6", "8"],
                "answer": "6",
                "delay": 0
            },
            {
                "id": "cognitive_3",
                "type": "pattern",
                "question": "Продолжите числовую последовательность",
                "stimulus": ["1", "2", "3", "5", "8"],
                "options": ["12", "13", "15"],
                "answer": "13",
                "delay": 0
            },
            {
                "id": "cognitive_4",
                "type": "cognitive",
                "question": "Этот тест оценивает ваши навыки визуальных аналогий.",
                "image": "https://med.vesti.ru/storage/article_images/1/51/151569_image.jpg",
                "images": [
                    "https://upload.wikimedia.org/wikipedia/commons/thumb/9/91/Octagon.svg/1200px-Octagon.svg.png",
                    "https://www.freeiconspng.com/thumbs/square-png/square-frame-png-22.png"
                ],
                "options": ["octagon", "square"],
                "answer": "octagon",
                "delay": 0
            },
            {
                "id": "cognitive_5",
                "type": "cognitive",
                "question": "Этот вопрос проверяет вашу способность к логическому мышлению и анализу математических последовательностей.",
                "stimulus": ["2", "4", "6", "8"],
                "options": ["10", "12", "14"],
                "answer": "10",
                "delay": 0
            }
        ]
    }
}

@cognitive_tests_bp.route('/api/cognitive-tests/config/<test_type>', methods=['GET'])
def get_test_config(test_type):
    if test_type in TEST_CONFIGURATIONS:
        return jsonify(TEST_CONFIGURATIONS[test_type])
    else:
        return jsonify({'error': 'Test type not found'}), 404

@cognitive_tests_bp.route('/api/cognitive-tests/submit', methods=['POST'])
def submit_test():
    try:
        data = request.get_json()
        test_type = data.get('test_type')
        answers = data.get('answers')
        duration = data.get('duration', 0)
        
        user_id = request.headers.get('X-User-ID', 'test_user')
        
        if not test_type or not answers:
            return jsonify({'error': 'Missing required fields'}), 400
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Check cooldown (5 minutes instead of 30)
        cursor.execute('''
            SELECT test_date FROM cognitive_test_results 
            WHERE user_id = ? AND test_type = ? 
            ORDER BY test_date DESC LIMIT 1
        ''', (user_id, test_type))
        
        last_test = cursor.fetchone()
        if last_test:
            last_test_time = datetime.fromisoformat(last_test[0])
            cooldown_time = timedelta(minutes=5)  # Changed from 30 to 5 minutes
            if datetime.now() - last_test_time < cooldown_time:
                cooldown_end = last_test_time + cooldown_time
                return jsonify({
                    'error': 'Test in cooldown',
                    'cooldown_end': cooldown_end.isoformat()
                }), 429
        
        # Calculate score
        config = TEST_CONFIGURATIONS.get(test_type)
        if not config:
            return jsonify({'error': 'Test configuration not found'}), 404
        
        questions = config.get('questions', [])
        total_questions = len(questions)
        correct_answers = 0
        
        for question in questions:
            question_id = question.get('id')
            correct_answer = question.get('answer')
            user_answer = answers.get(question_id)
            
            if user_answer is not None and str(user_answer).lower() == str(correct_answer).lower():
                correct_answers += 1
        
        score = (correct_answers / total_questions) * 100 if total_questions > 0 else 0
        
        # Prepare mistakes for detailed results
        mistakes = []
        for question in questions:
            question_id = question.get('id')
            correct_answer = question.get('answer')
            user_answer = answers.get(question_id, '')
            
            if str(user_answer).lower() != str(correct_answer).lower():
                mistakes.append({
                    'question': question.get('question', 'N/A'),
                    'user_answer': user_answer,
                    'correct_answer': correct_answer
                })
        
        # Insert test result into the database
        test_id = str(uuid.uuid4())
        cursor.execute('''
            INSERT INTO cognitive_test_results (test_id, user_id, test_type, test_date, score, duration, details) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (test_id, user_id, test_type, datetime.now().isoformat(), score, duration, json.dumps({
            'total_questions': total_questions,
            'correct_answers': correct_answers,
            'mistakes': mistakes,
            'error_analysis': analyze_errors(questions, answers)
        })))
        
        conn.commit()
        cursor.close()
        conn.close()
        
        return jsonify({'message': 'Test submitted successfully', 'score': score, 'test_id': test_id}), 200
        
    except Exception as e:
        print(f"Error submitting test: {e}")
        return jsonify({'error': 'Failed to submit test'}), 500

def analyze_errors(questions, answers):
    error_analysis = {}
    for question in questions:
        question_id = question.get('id')
        question_type = question.get('type', 'unknown')
        correct_answer = question.get('answer')
        user_answer = answers.get(question_id, '')
        
        if str(user_answer).lower() != str(correct_answer).lower():
            if question_type not in error_analysis:
                error_analysis[question_type] = 0
            error_analysis[question_type] += 1
    return error_analysis

@cognitive_tests_bp.route('/api/cognitive-tests/history', methods=['GET'])
def get_test_history():
    try:
        user_id = request.headers.get('X-User-ID', 'test_user')
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT test_id, test_type, test_date, score, duration FROM cognitive_test_results
            WHERE user_id = ?
            ORDER BY test_date DESC
        ''', (user_id,))
        
        history = []
        rows = cursor.fetchall()
        for row in rows:
            test_id, test_type, test_date, score, duration = row
            
            # Fetch cooldown info
            cursor.execute('''
                SELECT test_date FROM cognitive_test_results 
                WHERE user_id = ? AND test_type = ? 
                ORDER BY test_date DESC LIMIT 1
            ''', (user_id, test_type))
            
            last_test = cursor.fetchone()
            cooldown_end = None
            if last_test:
                last_test_time = datetime.fromisoformat(last_test[0])
                cooldown_time = timedelta(minutes=5)  # 5 minutes cooldown
                cooldown_end = last_test_time + cooldown_time
                if datetime.now() < cooldown_end:
                    cooldown_end = cooldown_end.isoformat()
                else:
                    cooldown_end = None
            
            history.append({
                'test_id': test_id,
                'test_type': test_type,
                'test_date': test_date,
                'score': score,
                'duration': duration,
                'cooldown_end': cooldown_end
            })
        
        cursor.close()
        conn.close()
        
        return jsonify(history), 200
        
    except Exception as e:
        print(f"Error fetching test history: {e}")
        return jsonify({'error': 'Failed to fetch test history'}), 500

@cognitive_tests_bp.route('/api/cognitive-tests/results/<test_id>', methods=['GET'])
def get_test_results(test_id):
    try:
        user_id = request.headers.get('X-User-ID', 'test_user')
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT test_type, test_date, score, duration, details FROM cognitive_test_results
            WHERE test_id = ? AND user_id = ?
        ''', (test_id, user_id))
        
        result = cursor.fetchone()
        if result:
            test_type, test_date, score, duration, details = result
            details = json.loads(details)
            
            # Fetch cooldown info
            cursor.execute('''
                SELECT test_date FROM cognitive_test_results 
                WHERE user_id = ? AND test_type = ? 
                ORDER BY test_date DESC LIMIT 1
            ''', (user_id, test_type))
            
            last_test = cursor.fetchone()
            cooldown_end = None
            if last_test:
                last_test_time = datetime.fromisoformat(last_test[0])
                cooldown_time = timedelta(minutes=5)  # 5 minutes cooldown
                cooldown_end = last_test_time + cooldown_time
                if datetime.now() < cooldown_end:
                    cooldown_end = cooldown_end.isoformat()
                else:
                    cooldown_end = None
            
            cursor.close()
            conn.close()
            
            return jsonify({
                'test_id': test_id,
                'test_type': test_type,
                'test_date': test_date,
                'score': score,
                'duration': duration,
                'details': details,
                'cooldown_end': cooldown_end
            }), 200
        else:
            cursor.close()
            conn.close()
            return jsonify({'error': 'Test results not found'}), 404
            
    except Exception as e:
        print(f"Error fetching test results: {e}")
        return jsonify({'error': 'Failed to fetch test results'}), 500

@cognitive_tests_bp.route('/api/cognitive-tests/cooldown/<test_type>', methods=['GET'])
def check_test_cooldown(test_type):
    try:
        user_id = request.headers.get('X-User-ID', 'test_user')
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT test_date FROM cognitive_test_results 
            WHERE user_id = ? AND test_type = ? 
            ORDER BY test_date DESC LIMIT 1
        ''', (user_id, test_type))
        
        last_test = cursor.fetchone()
        if last_test:
            last_test_time = datetime.fromisoformat(last_test[0])
            cooldown_time = timedelta(minutes=5)  # Changed from 30 to 5 minutes
            cooldown_end = last_test_time + cooldown_time
            
            if datetime.now() < cooldown_end:
                return jsonify({
                    'in_cooldown': True,
                    'cooldown_end': cooldown_end.isoformat()
                })
        
        return jsonify({'in_cooldown': False})
        
    except Exception as e:
        print(f"Error checking cooldown: {e}")
        return jsonify({'error': 'Failed to check cooldown'}), 500
