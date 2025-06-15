
from logging.handlers import RotatingFileHandler
import os
from flask import Flask, send_from_directory, jsonify, request, Response
from flask_cors import CORS
import logging
from datetime import timedelta, datetime
import sqlite3

# Import blueprints
from blueprints.auth import auth_bp, AuthError, handle_auth_error
from blueprints.fatigue_analysis import fatigue_bp
from blueprints.cognitive_tests import cognitive_bp
from blueprints.user_data import user_bp
from blueprints.feedback import feedback_bp
from blueprints.debug import debug_bp

# ... keep existing code (logging setup)

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

# Database helper function
def get_db_connection():
    conn = sqlite3.connect('database/database.db')
    conn.row_factory = sqlite3.Row
    return conn

# Add dashboard endpoints
@app.route('/api/dashboard/current-flight', methods=['GET'])
def get_current_flight():
    """Get current active flight or next scheduled flight"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # First, try to get an active flight (status = 'in_progress')
        cursor.execute("""
            SELECT flight_number, from_code, from_city, to_code, to_city, 
                   departure_time, arrival_time, status, duration
            FROM Flights 
            WHERE status = 'in_progress'
            ORDER BY departure_time ASC 
            LIMIT 1
        """)
        
        active_flight = cursor.fetchone()
        
        if active_flight:
            conn.close()
            return jsonify({
                'flight_number': active_flight['flight_number'],
                'route': f"{active_flight['from_city']} ({active_flight['from_code']}) → {active_flight['to_city']} ({active_flight['to_code']})",
                'departure_time': active_flight['departure_time'],
                'arrival_time': active_flight['arrival_time'],
                'duration': active_flight['duration'],
                'status': active_flight['status'],
                'isActive': True
            })
        
        # If no active flight, get next scheduled flight
        cursor.execute("""
            SELECT flight_number, from_code, from_city, to_code, to_city, 
                   departure_time, arrival_time, status, duration
            FROM Flights 
            WHERE datetime(departure_time) >= datetime('now') 
            AND status = 'scheduled'
            ORDER BY departure_time ASC 
            LIMIT 1
        """)
        
        next_flight = cursor.fetchone()
        conn.close()
        
        if next_flight:
            return jsonify({
                'flight_number': next_flight['flight_number'],
                'route': f"{next_flight['from_city']} ({next_flight['from_code']}) → {next_flight['to_city']} ({next_flight['to_code']})",
                'departure_time': next_flight['departure_time'],
                'arrival_time': next_flight['arrival_time'],
                'duration': next_flight['duration'],
                'status': next_flight['status'],
                'isActive': False
            })
        
        return jsonify({'message': 'No flights found'}), 404
        
    except Exception as e:
        logger.error(f"Error getting current flight: {e}")
        return jsonify({'error': 'Failed to get flight data'}), 500

@app.route('/api/dashboard/next-flight', methods=['GET'])
def get_next_flight():
    """Get next scheduled flight"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT flight_number, from_code, from_city, to_code, to_city, 
                   departure_time, arrival_time, status, duration
            FROM Flights 
            WHERE datetime(departure_time) >= datetime('now') 
            AND status = 'scheduled'
            ORDER BY departure_time ASC 
            LIMIT 1
        """)
        
        next_flight = cursor.fetchone()
        conn.close()
        
        if next_flight:
            return jsonify({
                'flight_number': next_flight['flight_number'],
                'route': f"{next_flight['from_city']} ({next_flight['from_code']}) → {next_flight['to_city']} ({next_flight['to_code']})",
                'departure_time': next_flight['departure_time'],
                'arrival_time': next_flight['arrival_time'],
                'duration': next_flight['duration'],
                'status': next_flight['status']
            })
        
        return jsonify({'message': 'No scheduled flights found'}), 404
        
    except Exception as e:
        logger.error(f"Error getting next flight: {e}")
        return jsonify({'error': 'Failed to get flight data'}), 500

@app.route('/api/dashboard/crew', methods=['GET'])
def get_dashboard_crew():
    """Get current crew members"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT e.name, e.position, cm.role 
            FROM Employees e 
            JOIN CrewMembers cm ON e.employee_id = cm.employee_id 
            WHERE cm.crew_id = (
                SELECT crew_id FROM Crews 
                ORDER BY crew_id DESC 
                LIMIT 1
            )
        """)
        
        crew_members = cursor.fetchall()
        conn.close()
        
        return jsonify([{
            'id': i + 1,
            'name': member['name'],
            'position': member['position'],
            'role': member['role']
        } for i, member in enumerate(crew_members)])
        
    except Exception as e:
        logger.error(f"Error getting crew data: {e}")
        return jsonify([])

@app.route('/api/dashboard/flight-stats', methods=['GET'])
def get_flight_stats():
    """Get flight statistics for current week and month"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Get current date
        now = datetime.now()
        week_start = now - timedelta(days=now.weekday())
        month_start = now.replace(day=1)
        
        # Weekly stats
        cursor.execute("""
            SELECT COUNT(*) as count, COALESCE(SUM(CAST(duration AS REAL)), 0) as hours
            FROM Flights 
            WHERE date(departure_time) >= date(?)
        """, (week_start.strftime('%Y-%m-%d'),))
        
        weekly_stats = cursor.fetchone()
        
        # Monthly stats
        cursor.execute("""
            SELECT COUNT(*) as count, COALESCE(SUM(CAST(duration AS REAL)), 0) as hours
            FROM Flights 
            WHERE date(departure_time) >= date(?)
        """, (month_start.strftime('%Y-%m-%d'),))
        
        monthly_stats = cursor.fetchone()
        conn.close()
        
        return jsonify({
            'weeklyFlights': weekly_stats['count'],
            'weeklyHours': round(weekly_stats['hours'], 1),
            'monthlyFlights': monthly_stats['count'],
            'monthlyHours': round(monthly_stats['hours'], 1)
        })
        
    except Exception as e:
        logger.error(f"Error getting flight stats: {e}")
        return jsonify({
            'weeklyFlights': 0,
            'weeklyHours': 0,
            'monthlyFlights': 0,
            'monthlyHours': 0
        })

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

# ... keep existing code (serve static files, video serving functions)

# Test sessions storage for cognitive tests
test_sessions = {}

if __name__ == '__main__':
    app.run(debug=True, port=5000)
