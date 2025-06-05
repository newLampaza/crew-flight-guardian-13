
import sqlite3
import os
import logging

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def migrate_video_paths():
    """
    Migrate video paths in database to remove /videos/ prefix
    This ensures all paths are stored as filenames only
    """
    db_path = 'database/database.db'
    
    if not os.path.exists(db_path):
        logger.error(f"Database file not found: {db_path}")
        return False
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Check current video paths in Flights table
        logger.info("Checking Flights table for video paths...")
        cursor.execute("SELECT flight_id, video_path FROM Flights WHERE video_path IS NOT NULL")
        flights = cursor.fetchall()
        
        updated_flights = 0
        for flight_id, video_path in flights:
            if video_path.startswith('/videos/'):
                new_path = video_path[8:]  # Remove '/videos/' prefix
                cursor.execute("UPDATE Flights SET video_path = ? WHERE flight_id = ?", 
                             (new_path, flight_id))
                logger.info(f"Updated flight {flight_id}: {video_path} -> {new_path}")
                updated_flights += 1
            elif video_path.startswith('/video/'):
                new_path = video_path[7:]  # Remove '/video/' prefix
                cursor.execute("UPDATE Flights SET video_path = ? WHERE flight_id = ?", 
                             (new_path, flight_id))
                logger.info(f"Updated flight {flight_id}: {video_path} -> {new_path}")
                updated_flights += 1
        
        # Check current video paths in FatigueAnalysis table
        logger.info("Checking FatigueAnalysis table for video paths...")
        cursor.execute("SELECT analysis_id, video_path FROM FatigueAnalysis WHERE video_path IS NOT NULL")
        analyses = cursor.fetchall()
        
        updated_analyses = 0
        for analysis_id, video_path in analyses:
            if video_path.startswith('/videos/'):
                new_path = video_path[8:]  # Remove '/videos/' prefix
                cursor.execute("UPDATE FatigueAnalysis SET video_path = ? WHERE analysis_id = ?", 
                             (new_path, analysis_id))
                logger.info(f"Updated analysis {analysis_id}: {video_path} -> {new_path}")
                updated_analyses += 1
            elif video_path.startswith('/video/'):
                new_path = video_path[7:]  # Remove '/video/' prefix
                cursor.execute("UPDATE FatigueAnalysis SET video_path = ? WHERE analysis_id = ?", 
                             (new_path, analysis_id))
                logger.info(f"Updated analysis {analysis_id}: {video_path} -> {new_path}")
                updated_analyses += 1
        
        # Commit changes
        conn.commit()
        
        logger.info(f"Migration completed successfully!")
        logger.info(f"Updated {updated_flights} flight records")
        logger.info(f"Updated {updated_analyses} analysis records")
        
        return True
        
    except Exception as e:
        logger.error(f"Migration failed: {str(e)}")
        if conn:
            conn.rollback()
        return False
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    migrate_video_paths()
