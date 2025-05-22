
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
        # Неизвестный тип сущности
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
                
                logger.info(f"Found {len(feedbacks) if feedbacks else 0} feedback entries")
                
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
                    
                # Проверяем наличие как camelCase, так и snake_case полей
                entity_type = data.get('entity_type') or data.get('entityType')
                entity_id = data.get('entity_id') or data.get('entityId')
                rating = data.get('rating')
                comments = data.get('comments')
                
                if not all([entity_type, entity_id, rating]):
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

                # Проверка на существующий отзыв
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
                    logger.info(f"Feedback already exists for {entity_type} #{entity_id}")
                    conn.close()
                    return jsonify({'error': 'Feedback already exists'}), 409

                # Добавляем новый отзыв
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
                logger.info(f"Feedback saved with ID: {feedback_id}")
                conn.close()
                
                return jsonify({
                    'id': feedback_id,
                    'message': 'Feedback submitted successfully'
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
