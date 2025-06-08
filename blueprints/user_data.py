
from flask import Blueprint, jsonify, request
import sqlite3
import logging
import traceback

# Setup logging
logger = logging.getLogger(__name__)
user_bp = Blueprint('user', __name__, url_prefix='/api')

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
@user_bp.route('/crew', methods=['GET'])
def get_crew():
    token_required = get_token_required()
    
    @token_required
    def _get_crew(current_user):
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
        
    return _get_crew()

@user_bp.route('/flights', methods=['GET'])
def get_flights():
    token_required = get_token_required()
    
    @token_required
    def _get_flights(current_user):
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
                f.video_path,
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
        
    return _get_flights()

@user_bp.route('/fatigue', methods=['GET'])
def get_fatigue_data():
    token_required = get_token_required()
    
    @token_required
    def _get_fatigue_data(current_user):
        conn = get_db_connection()
        data = conn.execute('''
            SELECT * FROM FatigueAnalysis
            WHERE employee_id = ?
            ORDER BY analysis_date DESC
        ''', (current_user['employee_id'],)).fetchall()
        conn.close()
        return jsonify([dict(row) for row in data])
        
    return _get_fatigue_data()

@user_bp.route('/flight-eligibility', methods=['GET'])
def get_flight_eligibility():
    token_required = get_token_required()
    
    @token_required
    def _get_flight_eligibility(current_user):
        conn = get_db_connection()
        try:
            from datetime import datetime
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
            logger.error(f"Error in flight eligibility: {str(e)}")
            return jsonify({'error': 'Internal server error'}), 500
        finally:
            conn.close()
            
    return _get_flight_eligibility()

@user_bp.route('/profile', methods=['GET'])
def get_profile():
    token_required = get_token_required()
    
    @token_required
    def _get_profile(current_user):
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
            
    return _get_profile()
