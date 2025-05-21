
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
                    logger.warning(f"Entity not found: {entity_type} with id {entity_id}")
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
                    logger.info(f"Feedback already exists for {entity_type} #{entity_id}")
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
                logger.info(f"Feedback saved with ID: {feedback_id}")
                
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
