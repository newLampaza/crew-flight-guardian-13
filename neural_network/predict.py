
import cv2
import numpy as np
import tensorflow as tf
import mediapipe as mp
import time
import os
from pathlib import Path
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Initialize face detection
mp_face_detection = mp.solutions.face_detection
mp_drawing = mp.solutions.drawing_utils
FaceDetection = mp_face_detection.FaceDetection

# Global analyzer instance for reuse
_GLOBAL_ANALYZER = None

def get_analyzer():
    """Returns the global analyzer instance, creating it if necessary"""
    global _GLOBAL_ANALYZER
    if _GLOBAL_ANALYZER is None:
        model_path = os.path.join('neural_network', 'data', 'models', 'fatigue_model.keras')
        if not os.path.exists(model_path):
            raise FileNotFoundError(f"Model not found at path: {model_path}")
        _GLOBAL_ANALYZER = FatigueAnalyzer(model_path)
    return _GLOBAL_ANALYZER

class FatigueAnalyzer:
    def __init__(self, model_path: str, buffer_size: int = 15):
        self.model = None
        self.model_path = model_path
        self.buffer = []
        self.buffer_size = buffer_size
        self.face_detector = None
        self.last_face_time = time.time()
        self.face_detected = False
        self.load_resources()
    
    def load_resources(self):
        """Loads the model and initializes the face detector"""
        try:
            self.model = tf.keras.models.load_model(self.model_path)
            # Lowering confidence threshold for better face detection
            self.face_detector = FaceDetection(min_detection_confidence=0.5, model_selection=1)
            logger.info("Model and face detector successfully loaded")
        except Exception as e:
            logger.error(f"Error loading resources: {e}")
            raise

    def process_frame(self, frame: np.ndarray) -> np.ndarray:
        """Processes a frame, drawing fatigue visualization"""
        if self.model is None or self.face_detector is None:
            try:
                self.load_resources()
            except Exception as e:
                logger.error(f"Failed to load model: {e}")
                return frame
        
        try:
            # Ensure the frame is not empty and is valid
            if frame is None or frame.size == 0 or not isinstance(frame, np.ndarray):
                logger.warning("Empty or invalid frame received")
                return frame

            # Create a copy of the frame for analysis and visualization
            output_frame = frame.copy()
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = self.face_detector.process(rgb_frame)
            
            # Add timestamp
            timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
            cv2.putText(output_frame, timestamp, (10, output_frame.shape[0] - 20), 
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
            
            if results.detections:
                self.face_detected = True
                self.last_face_time = time.time()
                
                # Process each detected face (usually just one)
                for detection in results.detections:
                    bbox = detection.location_data.relative_bounding_box
                    h, w = frame.shape[:2]
                    
                    x = int(bbox.xmin * w)
                    y = int(bbox.ymin * h)
                    width = int(bbox.width * w)
                    height = int(bbox.height * h)
                    
                    # Ensure coordinates are valid
                    x = max(0, x)
                    y = max(0, y)
                    width = min(w - x, width)
                    height = min(h - y, height)
                    
                    # Draw face detection confidence
                    confidence = round(detection.score[0] * 100, 1)
                    cv2.putText(output_frame, f"Face: {confidence}%", (x, y - 30), 
                                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)

                    # Only process if we have a reasonable size face
                    if width > 20 and height > 20:
                        try:
                            face_roi = frame[y:y+height, x:x+width]
                            processed = self._preprocess_face(face_roi)
                            prediction = self.model.predict(processed[None, ...], verbose=0)[0][0]
                            self._update_buffer(prediction)
                            
                            # Determine color based on fatigue level
                            if prediction > 0.65:
                                color = (0, 0, 255)  # Red for high fatigue
                                level = "High"
                            elif prediction > 0.4:
                                color = (0, 165, 255)  # Orange for medium fatigue
                                level = "Medium"
                            else:
                                color = (0, 255, 0)  # Green for low fatigue
                                level = "Low"
                            
                            # Draw bounding box around face
                            cv2.rectangle(output_frame, (x, y), (x+width, y+height), color, 2)
                            
                            # Draw current fatigue value
                            text = f"Fatigue: {prediction:.2f} ({level})"
                            cv2.putText(output_frame, text, (x, y-10), 
                                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 2)
                            
                            # Add average fatigue from buffer
                            if len(self.buffer) > 0:
                                mean_fatigue = np.mean(self.buffer)
                                level_text = "High" if mean_fatigue > 0.65 else ("Medium" if mean_fatigue > 0.4 else "Low")
                                mean_text = f"Avg: {mean_fatigue:.2f} ({level_text})"
                                cv2.putText(output_frame, mean_text, (x, y+height+25), 
                                            cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 2)
                            
                        except Exception as e:
                            logger.error(f"Face processing error: {str(e)}")
                            cv2.putText(output_frame, f"Error: {str(e)[:20]}", (x, y+height+45), 
                                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 255), 2)
            else:
                self.face_detected = False
                # Draw clear warning that no face is detected
                cv2.putText(output_frame, "NO FACE DETECTED", (int(output_frame.shape[1]/2) - 100, int(output_frame.shape[0]/2)), 
                            cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)
                cv2.putText(output_frame, "Please ensure your face is visible", (int(output_frame.shape[1]/2) - 180, int(output_frame.shape[0]/2) + 30), 
                            cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
            
            # Add buffer info
            buffer_info = f"Buffer: {len(self.buffer)}/{self.buffer_size}"
            cv2.putText(output_frame, buffer_info, (20, 20), 
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
            
            # Add face detection status
            face_status = "Face detected" if self.face_detected else "No face detected"
            cv2.putText(output_frame, face_status, (20, 40), 
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255) if self.face_detected else (0, 0, 255), 1)
            
        except Exception as e:
            logger.error(f"Frame processing error: {str(e)}")
            # Add error message to the frame
            cv2.putText(output_frame, f"Error: {str(e)[:30]}...", (20, 50), 
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
            
        # Return the processed frame with visualization
        return output_frame

    def _preprocess_face(self, face: np.ndarray) -> np.ndarray:
        """Preprocess face for the neural network"""
        try:
            # Convert to grayscale if needed (depends on how model was trained)
            if len(face.shape) == 3 and face.shape[2] == 3:
                face_gray = cv2.cvtColor(face, cv2.COLOR_BGR2GRAY)
                face_resized = cv2.resize(face_gray, (48, 48))
            else:
                face_resized = cv2.resize(face, (48, 48))
                
            # Normalize to [0,1]
            return face_resized.astype(np.float32) / 255.0
        except Exception as e:
            logger.error(f"Face preprocessing error: {str(e)}")
            # Return empty array if preprocessing fails
            return np.zeros((48, 48), dtype=np.float32)

    def _update_buffer(self, value: float):
        """Updates the buffer with a new fatigue value"""
        self.buffer.append(value)
        if len(self.buffer) > self.buffer_size:
            self.buffer.pop(0)

    def get_final_score(self) -> dict:
        """Returns the final fatigue score based on the buffer"""
        if not self.buffer or not self.face_detected:
            return {
                'level': 'Unknown', 
                'score': 0.0, 
                'percent': 0.0,
                'error': 'No face detected' if not self.face_detected else 'Insufficient data'
            }
            
        avg_score = np.mean(self.buffer)
        if avg_score < 0.4:
            level = "Low"
        elif avg_score < 0.65:
            level = "Medium"
        else:
            level = "High"
            
        return {
            'level': level,
            'score': round(avg_score, 2),
            'percent': round(avg_score * 100, 1),
            'error': None
        }
    
    def reset_buffer(self):
        """Resets the buffer for a new analysis"""
        self.buffer = []
        self.face_detected = False

def analyze_source(source, is_video_file=False, output_file=None):
    """Analyzes video from camera or file and returns fatigue level"""
    try:
        # Use the common analyzer
        analyzer = get_analyzer()
        analyzer.reset_buffer()
        
        if is_video_file and not os.path.exists(source):
            raise FileNotFoundError(f"Video file not found: {source}")
        
        # Open video source
        cap = cv2.VideoCapture(source if is_video_file else 0)
        if not cap.isOpened():
            raise ValueError(f"Failed to open video source: {source}")
        
        # Get video parameters
        frame_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        frame_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        fps = cap.get(cv2.CAP_PROP_FPS) 
        
        # Log video parameters
        logger.info(f"Video parameters: {frame_width}x{frame_height} @ {fps:.1f} FPS")
        
        # Prepare video writer for output file
        if output_file:
            fourcc = cv2.VideoWriter_fourcc(*'XVID')
            out = cv2.VideoWriter(
                output_file, 
                fourcc, 
                30.0 if fps < 1 else fps,  # Use 30fps if we can't determine FPS
                (frame_width, frame_height)
            )
        
        frame_count = 0
        face_detected_count = 0
        max_frames = 300  # Maximum 10 seconds at 30 FPS
        
        while cap.isOpened() and frame_count < max_frames:
            ret, frame = cap.read()
            if not ret:
                logger.warning("Failed to read frame")
                break
                
            # Analyze frame with visualization
            processed_frame = analyzer.process_frame(frame)
            frame_count += 1
            
            if analyzer.face_detected:
                face_detected_count += 1
            
            # Write frame with visualization
            if output_file and 'out' in locals():
                out.write(processed_frame)
            
            # Show frames only in debug mode
            if not is_video_file:
                cv2.imshow('Analysis', processed_frame)
                if cv2.waitKey(1) & 0xFF == ord('q'):
                    break
        
        cap.release()
        if output_file and 'out' in locals():
            out.release()
        cv2.destroyAllWindows()
        
        # Get final result
        result = analyzer.get_final_score()
        
        # Add metadata to the result
        result['resolution'] = f"{frame_width}x{frame_height}"
        result['fps'] = round(fps)
        result['frames_analyzed'] = frame_count
        result['face_detected_ratio'] = face_detected_count / frame_count if frame_count > 0 else 0
        
        if face_detected_count == 0:
            result['level'] = 'Unknown'
            result['score'] = 0.0
            result['percent'] = 0.0
            result['error'] = 'No face detected in video'
            logger.error("Analysis failed: No face detected in video")
            
        logger.info(f"Analysis completed: level={result['level']}, percent={result['percent']}")
        return result['level'], result['percent'], result
        
    except Exception as e:
        logger.error(f"Video analysis error: {str(e)}")
        return "Unknown", 0, {
            'level': 'Unknown',
            'score': 0.0,
            'percent': 0.0,
            'error': str(e)
        }

if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--mode', choices=['video', 'realtime'], required=True)
    parser.add_argument('--input', help='Path to input video')
    parser.add_argument('--output', help='Path to output video')
    args = parser.parse_args()
    
    if args.mode == 'video' and not args.input:
        print("Error: Input video required")
        exit(1)
        
    level, percent, details = analyze_source(
        source=args.input if args.mode == 'video' else 0,
        is_video_file=args.mode == 'video',
        output_file=args.output
    )
    
    print(f"Fatigue Level: {level}")
    print(f"Fatigue Percentage: {percent}%")
    if 'error' in details and details['error']:
        print(f"Error: {details['error']}")
