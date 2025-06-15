
"""
Utility functions for standardized date handling in backend
All dates in the system use ISO 8601 format: YYYY-MM-DDTHH:MM:SS
"""

from datetime import datetime, timedelta
import sqlite3

def get_current_datetime() -> str:
    """Get current datetime in ISO format"""
    return datetime.now().isoformat()

def get_current_date() -> str:
    """Get current date in ISO format (YYYY-MM-DD)"""
    return datetime.now().date().isoformat()

def format_datetime_for_db(dt: datetime) -> str:
    """Format datetime object for database storage"""
    return dt.isoformat()

def parse_datetime_from_db(date_string: str) -> datetime:
    """Parse datetime string from database"""
    if not date_string:
        raise ValueError('Invalid date string')
    
    # Handle both ISO format and SQLite datetime format
    if 'T' not in date_string:
        date_string = date_string.replace(' ', 'T')
    
    try:
        return datetime.fromisoformat(date_string.replace('Z', ''))
    except ValueError:
        raise ValueError(f'Invalid date format: {date_string}')

def add_minutes_to_datetime(date_string: str, minutes: int) -> str:
    """Add minutes to a datetime string"""
    dt = parse_datetime_from_db(date_string)
    new_dt = dt + timedelta(minutes=minutes)
    return format_datetime_for_db(new_dt)

def calculate_duration_minutes(start_datetime: str, end_datetime: str) -> int:
    """Calculate duration between two datetimes in minutes"""
    try:
        start = parse_datetime_from_db(start_datetime)
        end = parse_datetime_from_db(end_datetime)
        return int((end - start).total_seconds() / 60)
    except (ValueError, TypeError):
        return 0

def is_today(date_string: str) -> bool:
    """Check if date is today"""
    try:
        date = parse_datetime_from_db(date_string)
        return date.date() == datetime.now().date()
    except (ValueError, TypeError):
        return False

def get_cooldown_end(minutes: int = 30) -> str:
    """Get cooldown end time (current time + minutes)"""
    future_time = datetime.now() + timedelta(minutes=minutes)
    return format_datetime_for_db(future_time)
