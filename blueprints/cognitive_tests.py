
from flask import Blueprint, jsonify, request
import sqlite3
import logging
import uuid
import json
import traceback
from datetime import datetime, timedelta
import random

# Setup logging
logger = logging.getLogger(__name__)

# Create blueprint
cognitive_bp = Blueprint('cognitive', __name__, url_prefix='/api')

# Helper functions
def get_db_connection():
    conn = sqlite3.connect('database/database.db')
    conn.row_factory = sqlite3.Row
    return conn

# Test session storage (in-memory for now)
test_sessions = {}

def generate_test_questions(test_type, count=5):
    """Generates questions for cognitive tests based on type"""
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
    
    while len(question_types) < count:
        question_types.extend(question_types)
    
    questions = []
    for i in range(count):
        question_type = question_types[i % len(question_types)]
        questions.append(generate_question(question_type))
    
    return questions

def generate_question(question_type):
    """Generates a single question based on its type with complete implementation"""
    question_id = str(uuid.uuid4())
    
    if question_type == 'difference':
        images = [
            'https://images.unsplash.com/photo-1488590528505-98d2b5aba04b',
            'https://images.unsplash.com/photo-1461749280684-dccba630e2f6'
        ]
        differences = random.choice([2, 3, 4, 5])
        correct_answer = f"{differences} отличия"
        
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
        patterns = [
            {'sequence': ['⭐', '⚡', '⭐', '⚡', '⭐'], 'next': '⚡'},
            {'sequence': ['🔴', '🔵', '🟢', '🔴', '🔵'], 'next': '🟢'},
            {'sequence': ['1', '3', '5', '7', '9'], 'next': '11'},
            {'sequence': ['A', 'C', 'E', 'G', 'I'], 'next': 'K'}
        ]
        
        selected_pattern = random.choice(patterns)
        stimulus = selected_pattern['sequence']
        correct_answer = selected_pattern['next']
        
        wrong_answers = []
        all_symbols = ['⭐', '⚡', '🌙', '⚪', '🔴', '🔵', '🟢', '🟡', 'X', 'Y', 'Z']
        
        if correct_answer.isdigit():
            wrong_answers = [str(int(correct_answer) + 2), str(int(correct_answer) - 2), 
                            str(int(correct_answer) + 4)]
        elif correct_answer in all_symbols:
            wrong_answers = [sym for sym in all_symbols if sym != correct_answer][:3]
        else:
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
        logic_questions = [
            {
                'question': 'Если все А являются Б, и все Б являются В, то все А являются В?',
                'options': ['Да', 'Нет', 'Недостаточно информации', 'Зависит от контекста'],
                'correct_answer': 'Да'
            },
            {
                'question': 'В комнате 4 угла. В каждом углу сидит кошка. Напротив каждой кошки сидят 3 кошки. Сколько кошек в комнате?',
                'options': ['4', '8', '12', '16'],
                'correct_answer': '4'
            },
            {
                'question': 'Продолжите логическую цепочку: 2, 6, 12, 20, 30, ?',
                'options': ['40', '42', '44', '45'],
                'correct_answer': '42'
            }
        ]
        
        selected_logic = random.choice(logic_questions)
        return {
            'id': question_id,
            'type': question_type,
            'question': selected_logic['question'],
            'options': selected_logic['options'],
            'correct_answer': selected_logic['correct_answer'],
            'time_limit': 30
        }
    
    elif question_type == 'math':
        math_questions = [
            {
                'question': 'Решите уравнение: 3x + 7 = 22',
                'options': ['x = 5', 'x = 4', 'x = 6', 'x = 3'],
                'correct_answer': 'x = 5'
            },
            {
                'question': 'Найдите 15% от 200',
                'options': ['25', '30', '35', '40'],
                'correct_answer': '30'
            },
            {
                'question': 'Если товар стоил 100 рублей, а его цена увеличилась на 20%, сколько он стоит сейчас?',
                'options': ['120 рублей', '125 рублей', '110 рублей', '130 рублей'],
                'correct_answer': '120 рублей'
            }
        ]
        
        selected_math = random.choice(math_questions)
        return {
            'id': question_id,
            'type': question_type,
            'question': selected_math['question'],
            'options': selected_math['options'],
            'correct_answer': selected_math['correct_answer'],
            'time_limit': 30
        }
    
    elif question_type == 'select':
        select_questions = [
            {
                'question': 'Выберите все цвета, которые являются основными',
                'options': ['Красный', 'Синий', 'Желтый', 'Зеленый', 'Оранжевый', 'Фиолетовый'],
                'correct_answer': 'Красный,Синий,Желтый',
                'multiple_select': True
            },
            {
                'question': 'Выберите все четные числа',
                'options': ['2', '3', '4', '5', '6', '7', '8'],
                'correct_answer': '2,4,6,8',
                'multiple_select': True
            }
        ]
        
        selected_select = random.choice(select_questions)
        return {
            'id': question_id,
            'type': question_type,
            'question': selected_select['question'],
            'options': selected_select['options'],
            'correct_answer': selected_select['correct_answer'],
            'multiple_select': selected_select['multiple_select'],
            'time_limit': 20
        }
    
    elif question_type == 'sequence':
        sequences = [
            {
                'sequence': ['яблоко', 'банан', 'груша'],
                'question': 'Запомните последовательность фруктов'
            },
            {
                'sequence': ['красный', 'синий', 'зеленый', 'желтый'],
                'question': 'Запомните последовательность цветов'
            },
            {
                'sequence': ['1', '4', '7', '10'],
                'question': 'Запомните последовательность чисел'
            }
        ]
        
        selected_seq = random.choice(sequences)
        sequence = selected_seq['sequence']
        shuffled = sequence.copy()
        random.shuffle(shuffled)
        
        return {
            'id': question_id,
            'type': question_type,
            'question': selected_seq['question'],
            'options': shuffled,
            'correct_answer': ','.join(sequence),
            'delay': 5,
            'time_limit': 30
        }
    
    elif question_type == 'words':
        word_sets = [
            ['собака', 'кошка', 'мышь', 'слон', 'тигр'],
            ['стол', 'стул', 'диван', 'кровать', 'шкаф'],
            ['красный', 'синий', 'зеленый', 'желтый', 'черный']
        ]
        
        selected_words = random.choice(word_sets)
        target_words = random.sample(selected_words, 3)
        all_words = selected_words + ['лошадь', 'машина', 'дом']
        random.shuffle(all_words)
        
        return {
            'id': question_id,
            'type': question_type,
            'question': 'Запомните слова, которые будут показаны',
            'options': all_words,
            'correct_answer': ','.join(sorted(target_words)),
            'stimulus': target_words,
            'delay': 4,
            'multiple_select': True,
            'time_limit': 20
        }
    
    elif question_type == 'images':
        image_sets = [
            [
                'https://images.unsplash.com/photo-1518770660439-4636190af475?w=200&auto=format&fit=crop&q=60',
                'https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?w=200&auto=format&fit=crop&q=60',
                'https://images.unsplash.com/photo-1649972904349-6e44c42644a7?w=200&auto=format&fit=crop&q=60'
            ]
        ]
        
        selected_images = random.choice(image_sets)
        target_images = random.sample(selected_images, 2)
        all_images = selected_images + [
            'https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?w=200&auto=format&fit=crop&q=60'
        ]
        random.shuffle(all_images)
        
        return {
            'id': question_id,
            'type': question_type,
            'question': 'Запомните изображения, которые будут показаны',
            'options': all_images,
            'correct_answer': ','.join(target_images),
            'stimulus': target_images,
            'delay': 5,
            'multiple_select': True,
            'time_limit': 25
        }
    
    elif question_type == 'pairs':
        pair_sets = [
            {
                'pairs': [('Москва', 'Россия'), ('Париж', 'Франция'), ('Токио', 'Япония')],
                'question': 'Запомните соответствия: город - страна'
            },
            {
                'pairs': [('1', 'один'), ('2', 'два'), ('3', 'три')],
                'question': 'Запомните соответствия: цифра - слово'
            }
        ]
        
        selected_pairs = random.choice(pair_sets)
        pairs = selected_pairs['pairs']
        
        options = [pair[0] for pair in pairs]
        answer_options = [pair[1] for pair in pairs]
        random.shuffle(answer_options)
        
        correct_mapping = {pair[0]: pair[1] for pair in pairs}
        correct_answer = ','.join([f"{k}:{v}" for k, v in correct_mapping.items()])
        
        return {
            'id': question_id,
            'type': question_type,
            'question': selected_pairs['question'],
            'options': options,
            'answer_options': answer_options,
            'correct_answer': correct_answer,
            'delay': 6,
            'time_limit': 30
        }
    
    elif question_type == 'matrix':
        matrices = [
            {
                'matrix': [
                    [1, 2, 3],
                    [4, 5, 6],
                    [7, 8, 9]
                ],
                'question_text': 'Какое число было в центре матрицы?',
                'options': ['4', '5', '6', '8'],
                'correct_answer': '5'
            },
            {
                'matrix': [
                    ['A', 'B'],
                    ['C', 'D']
                ],
                'question_text': 'Какая буква была в правом верхнем углу?',
                'options': ['A', 'B', 'C', 'D'],
                'correct_answer': 'B'
            }
        ]
        
        selected_matrix = random.choice(matrices)
        
        return {
            'id': question_id,
            'type': question_type,
            'question': 'Запомните расположение элементов в матрице',
            'matrix': selected_matrix['matrix'],
            'question_text': selected_matrix['question_text'],
            'options': selected_matrix['options'],
            'correct_answer': selected_matrix['correct_answer'],
            'delay': 4,
            'time_limit': 20
        }
    
    elif question_type == 'reaction':
        return {
            'id': question_id,
            'type': question_type,
            'question': 'Тест на скорость реакции',
            'correct_answer': 'good_reaction',
            'time_limit': 60
        }
    
    elif question_type == 'memory':
        memory_sequences = [
            {
                'sequence': ['↑', '→', '↓', '←', '↑'],
                'question': 'Запомните последовательность стрелок'
            },
            {
                'sequence': ['🔴', '🔵', '🟢', '🟡', '🔴'],
                'question': 'Запомните последовательность цветов'
            }
        ]
        
        selected_memory = random.choice(memory_sequences)
        sequence = selected_memory['sequence']
        
        # Создаем варианты ответов
        options = [
            '→'.join(sequence),  # правильный
            '→'.join(sequence[:-1] + [random.choice(['⬆', '⬇', '⬅', '➡'])]),  # с заменой последнего
            '→'.join([sequence[0]] + sequence[:-1]),  # с перестановкой
            '→'.join(sequence[::-1])  # в обратном порядке
        ]
        random.shuffle(options)
        
        return {
            'id': question_id,
            'type': question_type,
            'question': selected_memory['question'],
            'stimulus': sequence,
            'options': options,
            'correct_answer': '→'.join(sequence),
            'delay': 3,
            'time_limit': 25
        }
    
    elif question_type == 'matrix_selection':
        grid_tasks = [
            {
                'grid': [
                    ['2', '4', '6', '8'],
                    ['1', '3', '5', '7'],
                    ['10', '12', '14', '16'],
                    ['9', '11', '13', '15']
                ],
                'question_text': 'Отметьте все четные числа',
                'correct_answer': '0-0,0-1,0-2,0-3,2-0,2-1,2-2,2-3'
            },
            {
                'grid': [
                    ['A', 'B', 'C'],
                    ['D', 'E', 'F'],
                    ['G', 'H', 'I']
                ],
                'question_text': 'Отметьте все гласные буквы',
                'correct_answer': '0-0,1-1,2-2'
            },
            {
                'grid': [
                    ['🔴', '🔵', '🟢'],
                    ['🟡', '🔴', '🔵'],
                    ['🟢', '🟡', '🔴']
                ],
                'question_text': 'Отметьте все красные круги',
                'correct_answer': '0-0,1-1,2-2'
            }
        ]
        
        selected_task = random.choice(grid_tasks)
        
        return {
            'id': question_id,
            'type': question_type,
            'question': 'Выполните задание с матрицей',
            'grid': selected_task['grid'],
            'question_text': selected_task['question_text'],
            'correct_answer': selected_task['correct_answer'],
            'time_limit': 30
        }
    
    elif question_type == 'cognitive':
        cognitive_tasks = [
            {
                'question': 'Найдите следующее число в математической последовательности',
                'stimulus': ['2', '6', '18', '54'],
                'options': ['162', '108', '72', '216'],
                'correct_answer': '162'
            },
            {
                'question': 'Решите визуальные аналогии',
                'image': 'https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?w=300&auto=format&fit=crop&q=60',
                'images': [
                    'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=200&auto=format&fit=crop&q=60',
                    'https://images.unsplash.com/photo-1518770660439-4636190af475?w=200&auto=format&fit=crop&q=60',
                    'https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?w=200&auto=format&fit=crop&q=60',
                    'https://images.unsplash.com/photo-1649972904349-6e44c42644a7?w=200&auto=format&fit=crop&q=60'
                ],
                'options': ['Вариант 1', 'Вариант 2', 'Вариант 3', 'Вариант 4'],
                'correct_answer': 'Вариант 2'
            }
        ]
        
        selected_cognitive = random.choice(cognitive_tasks)
        
        return {
            'id': question_id,
            'type': question_type,
            'question': selected_cognitive['question'],
            'stimulus': selected_cognitive.get('stimulus'),
            'image': selected_cognitive.get('image'),
            'images': selected_cognitive.get('images'),
            'options': selected_cognitive['options'],
            'correct_answer': selected_cognitive['correct_answer'],
            'time_limit': 45
        }
    
    else:
        # Fallback для неизвестных типов
        return {
            'id': question_id,
            'type': question_type,
            'question': f'Тестовый вопрос для типа {question_type}',
            'options': ['Вариант 1', 'Вариант 2', 'Вариант 3', 'Вариант 4'],
            'correct_answer': 'Вариант 2',
            'time_limit': 20
        }

# ... keep existing code (calculate_results and other functions) the same ...

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

# Import token_required from auth blueprint
def get_token_required():
    from blueprints.auth import get_token_required
    return get_token_required()

# ... keep existing code (all routes) the same ...
# Routes
@cognitive_bp.route('/tests/start', methods=['POST'])
def start_test():
    token_required = get_token_required()
    
    @token_required
    def _start_test(current_user):
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
            logger.error(f"Error starting test: {traceback.format_exc()}")
            return jsonify({'error': str(e)}), 500
            
    return _start_test()

@cognitive_bp.route('/tests/submit', methods=['POST'])
def submit_test():
    token_required = get_token_required()
    
    @token_required
    def _submit_test(current_user):
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
            logger.error(f"Error submitting test: {traceback.format_exc()}")
            return jsonify({'error': str(e)}), 500
            
    return _submit_test()

@cognitive_bp.route('/tests/results/<int:test_id>', methods=['GET'])
def get_test_results(test_id):
    token_required = get_token_required()
    
    @token_required
    def _get_test_results(current_user, test_id):
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
            logger.error(f"Error getting test results: {str(e)}")
            return jsonify({"error": str(e)}), 500
        finally:
            if conn:
                conn.close()
                
    return _get_test_results(test_id)

@cognitive_bp.route('/cognitive-tests', methods=['GET'])
def get_cognitive_tests():
    token_required = get_token_required()
    
    @token_required
    def _get_cognitive_tests(current_user):
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
            logger.error(f"Error getting cognitive tests: {str(e)}")
            return jsonify({"error": str(e)}), 500
        finally:
            if conn:
                conn.close()
                
    return _get_cognitive_tests()

@cognitive_bp.route('/tests/cooldown/<string:test_type>', methods=['GET'])
@cognitive_bp.route('/cognitive-tests/cooldown/<string:test_type>', methods=['GET'])
def check_test_cooldown(test_type):
    token_required = get_token_required()
    
    @token_required
    def _check_test_cooldown(current_user):
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
            logger.error(f"Error in test cooldown check: {str(e)}")
            return jsonify({'error': str(e)}), 500
        finally:
            conn.close()
            
    return _check_test_cooldown()

@cognitive_bp.route('/cognitive-tests/<int:test_id>/results', methods=['GET'])
def get_test_details(test_id):
    token_required = get_token_required()
    
    @token_required
    def _get_test_details(current_user):
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
            logger.error(f"Database error: {str(e)}")
            return jsonify({"error": "Database operation failed"}), 500
        except Exception as e:
            logger.error(f"Unexpected error: {str(e)}")
            return jsonify({"error": "Internal server error"}), 500
        finally:
            conn.close()
            
    return _get_test_details()