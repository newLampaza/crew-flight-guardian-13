
from flask import Blueprint, jsonify, request
import sqlite3
import logging
import traceback
from datetime import datetime

# Setup logging
logger = logging.getLogger(__name__)
feedback_bp = Blueprint('feedback', __name__, url_prefix='/api')

# Helper functions
def get_db_connection():
    conn = sqlite3.connect('database/database.db')
    conn.row_factory = sqlite3.Row
    return conn

def entity_exists(conn, entity_type, entity_id):
    """Проверяет существование сущности в базе данных"""
    if entity_type == 'flight':
        result = conn.execute('SELECT 1 FROM Flights WHERE flight_id = ?', (entity_id,)).fetchone()
    elif entity_type == 'cognitive_test':
        result = conn.execute('SELECT 1 FROM CognitiveTests WHERE test_id = ?', (entity_id,)).fetchone()
    elif entity_type == 'fatigue_analysis':
        result = conn.execute('SELECT 1 FROM FatigueAnalysis WHERE analysis_id = ?', (entity_id,)).fetchone()
    else:
        return False
    return result is not None

# Import token_required from auth blueprint
def get_token_required():
    from blueprints.auth import get_token_required
    return get_token_required()

# Routes
@feedback_bp.route('/feedback', methods=['GET', 'POST'])
def handle_feedback():
    token_required = get_token_required()
    
    @token_required
    def _handle_feedback(current_user):
        logger.info(f"Handling feedback request: {request.method}")
        if request.method == 'GET':
            try:
                conn = get_db_connection()
                
                # Get flight feedback
                flight_feedbacks = conn.execute('''
                    SELECT 
                        ff.feedback_id,
                        'flight' as entity_type,
                        ff.flight_id as entity_id,
                        f.from_code || ' - ' || f.to_code as entity_info,
                        ff.rating,
                        ff.comments,
                        ff.created_at
                    FROM FlightFeedback ff
                    JOIN Flights f ON ff.flight_id = f.flight_id
                    WHERE ff.employee_id = ?
                ''', (current_user['employee_id'],)).fetchall()
                
                # Get fatigue analysis feedback
                fatigue_feedbacks = conn.execute('''
                    SELECT 
                        faf.feedback_id,
                        'fatigue_analysis' as entity_type,
                        faf.analysis_id as entity_id,
                        fa.fatigue_level || ' (' || CAST(ROUND(fa.neural_network_score * 100) AS INTEGER) || '%)' as entity_info,
                        faf.rating,
                        faf.comments,
                        faf.created_at
                    FROM FatigueAnalysisFeedback faf
                    JOIN FatigueAnalysis fa ON faf.analysis_id = fa.analysis_id
                    WHERE faf.employee_id = ?
                ''', (current_user['employee_id'],)).fetchall()
                
                # Combine and sort by date
                all_feedbacks = []
                
                for feedback in flight_feedbacks:
                    all_feedbacks.append({
                        'id': feedback['feedback_id'],
                        'type': feedback['entity_type'],
                        'entityId': feedback['entity_id'],
                        'entityInfo': feedback['entity_info'],
                        'rating': feedback['rating'],
                        'comments': feedback['comments'] or '',
                        'date': feedback['created_at']
                    })
                
                for feedback in fatigue_feedbacks:
                    all_feedbacks.append({
                        'id': feedback['feedback_id'],
                        'type': feedback['entity_type'],
                        'entityId': feedback['entity_id'],
                        'entityInfo': feedback['entity_info'],
                        'rating': feedback['rating'],
                        'comments': feedback['comments'] or '',
                        'date': feedback['created_at']
                    })
                
                # Sort by date descending
                all_feedbacks.sort(key=lambda x: x['date'], reverse=True)
                
                logger.info(f"Found {len(all_feedbacks)} feedback entries")
                conn.close()
                
                return jsonify(all_feedbacks)
            
            except sqlite3.Error as e:
                logger.error(f"Database error in feedback GET: {str(e)}")
                return jsonify({'error': 'Failed to fetch feedback'}), 500
            except Exception as e:
                logger.error(f"Unexpected error in feedback GET: {str(e)}")
                return jsonify({'error': 'Internal server error'}), 500
            finally:
                if 'conn' in locals():
                    conn.close()

        elif request.method == 'POST':
            try:
                logger.info(f"Received feedback data: {request.json}")
                data = request.get_json()
                
                if not data:
                    logger.warning("Empty request body")
                    return jsonify({'error': 'No data provided'}), 400
                    
                entity_type = data.get('entity_type') or data.get('entityType')
                entity_id = data.get('entity_id') or data.get('entityId')
                rating = data.get('rating')
                comments = data.get('comments', '')
                
                if not all([entity_type, entity_id is not None, rating]):
                    logger.warning(f"Missing required fields. Got: {data}")
                    return jsonify({'error': 'Missing required fields'}), 400

                try:
                    entity_id = int(entity_id)
                    rating = int(rating)
                except (ValueError, TypeError):
                    logger.warning(f"Invalid data types: entity_id={entity_id}, rating={rating}")
                    return jsonify({'error': 'Invalid data types'}), 400

                if not 1 <= rating <= 5:
                    return jsonify({'error': 'Rating must be between 1 and 5'}), 400

                conn = get_db_connection()
                
                # Проверяем существование сущности
                if not entity_exists(conn, entity_type, entity_id):
                    logger.warning(f"Entity not found: {entity_type} with id {entity_id}")
                    conn.close()
                    return jsonify({'error': f'{entity_type} not found'}), 404

                cursor = conn.cursor()
                
                if entity_type == 'flight':
                    # Проверка на существующий отзыв о рейсе
                    existing = conn.execute('''
                        SELECT 1 FROM FlightFeedback 
                        WHERE employee_id = ? AND flight_id = ?
                    ''', (current_user['employee_id'], entity_id)).fetchone()

                    if existing:
                        logger.info(f"Flight feedback already exists for flight #{entity_id}")
                        conn.close()
                        return jsonify({'error': 'Feedback already exists'}), 409

                    # Добавляем новый отзыв о рейсе
                    cursor.execute('''
                        INSERT INTO FlightFeedback (
                            employee_id, flight_id, rating, comments, created_at
                        ) VALUES (?, ?, ?, ?, datetime('now'))
                    ''', (current_user['employee_id'], entity_id, rating, comments))
                    
                elif entity_type == 'fatigue_analysis':
                    # Проверка на существующий отзыв об анализе усталости
                    existing = conn.execute('''
                        SELECT 1 FROM FatigueAnalysisFeedback 
                        WHERE employee_id = ? AND analysis_id = ?
                    ''', (current_user['employee_id'], entity_id)).fetchone()

                    if existing:
                        logger.info(f"Fatigue analysis feedback already exists for analysis #{entity_id}")
                        conn.close()
                        return jsonify({'error': 'Feedback already exists'}), 409

                    # Добавляем новый отзыв об анализе усталости
                    cursor.execute('''
                        INSERT INTO FatigueAnalysisFeedback (
                            employee_id, analysis_id, rating, comments, created_at
                        ) VALUES (?, ?, ?, ?, datetime('now'))
                    ''', (current_user['employee_id'], entity_id, rating, comments))
                
                else:
                    conn.close()
                    return jsonify({'error': 'Invalid entity type'}), 400
                
                conn.commit()
                feedback_id = cursor.lastrowid
                logger.info(f"Feedback saved with ID: {feedback_id}")
                conn.close()
                
                return jsonify({
                    'id': feedback_id,
                    'entity_type': entity_type,
                    'entity_id': entity_id,
                    'rating': rating,
                    'comments': comments,
                    'date': datetime.now().isoformat()
                }), 201

            except sqlite3.Error as e:
                logger.error(f"Database error in feedback POST: {str(e)}")
                return jsonify({'error': 'Failed to save feedback'}), 500
            except Exception as e:
                logger.error(f"Unexpected error in feedback POST: {traceback.format_exc()}")
                return jsonify({'error': 'Internal server error'}), 500
            finally:
                if 'conn' in locals():
                    conn.close()
                    
    return _handle_feedback()
