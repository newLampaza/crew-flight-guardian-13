
from flask import Blueprint, jsonify
import sqlite3
import logging
import os

# Setup logging
logger = logging.getLogger(__name__)
debug_bp = Blueprint('debug', __name__, url_prefix='/api')

# Helper functions
def get_db_connection():
    conn = sqlite3.connect('database/database.db')
    conn.row_factory = sqlite3.Row
    return conn

# Routes
@debug_bp.route('/debug/check-db', methods=['GET'])
def check_database():
    try:
        conn = get_db_connection()
        # Check if we can access the database
        tables = conn.execute("SELECT name FROM sqlite_master WHERE type='table';").fetchall()
        table_names = [table['name'] for table in tables]
        conn.close()
        return jsonify({
            'status': 'OK',
            'database_file': os.path.join('database', 'database.db'),
            'tables': table_names
        })
    except sqlite3.Error as e:
        return jsonify({
            'status': 'ERROR',
            'error': str(e),
            'database_file': os.path.join('database', 'database.db')
        }), 500
