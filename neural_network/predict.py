
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

# Простейшая инициализация MediaPipe без дополнительных параметров
mp_face_detection = mp.solutions.face_detection

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
        self.model = tf.keras.models.load_model(model_path)
        self.buffer = []
        self.buffer_size = buffer_size
        # Используем самую простую конфигурацию
        self.face_detector = mp_face_detection.FaceDetection(min_detection_confidence=0.5)
        self.last_face_time = time.time()
        self.face_detected_frames = 0
        self.total_frames = 0

    def process_frame(self, frame: np.ndarray) -> np.ndarray:
        """Process frame with simple face detection"""
        self.total_frames += 1
        
        # Convert to RGB for MediaPipe
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        
        try:
            results = self.face_detector.process(rgb_frame)
        except Exception as e:
            logger.error(f"Face detection error: {e}")
            # Если ошибка детекции, просто пропускаем кадр
            return frame
        
        if results.detections:
            self.last_face_time = time.time()
            self.face_detected_frames += 1
            
            for detection in results.detections:
                try:
                    bbox = detection.location_data.relative_bounding_box
                    h, w = frame.shape[:2]
                    
                    x = int(bbox.xmin * w)
                    y = int(bbox.ymin * h)
                    width = int(bbox.width * w)
                    height = int(bbox.height * h)
                    
                    x = max(0, x)
                    y = max(0, y)
                    width = min(w - x, width)
                    height = min(h - y, height)

                    if width > 10 and height > 10:
                        face_roi = frame[y:y+height, x:x+width]
                        processed = self._preprocess_face(face_roi)
                        prediction = self.model.predict(processed[None, ...], verbose=0)[0][0]
                        self._update_buffer(prediction)
                        
                        # Рисуем прямоугольник и текст
                        color = (0, 0, 255) if prediction > 0.5 else (0, 255, 0)
                        cv2.rectangle(frame, (x, y), (x+width, y+height), color, 2)
                        
                        avg_score = np.mean(self.buffer) if self.buffer else 0
                        cv2.putText(frame, f"Fatigue: {avg_score:.2f}", 
                                   (x, y-10), cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 2)
                except Exception as e:
                    logger.error(f"Processing error: {str(e)}")
                    continue
        else:
            # Если лицо не обнаружено более 2 секунд, добавляем высокое значение усталости
            if time.time() - self.last_face_time > 2:
                self.buffer.append(1.0)
        
        return frame

    def _preprocess_face(self, face: np.ndarray) -> np.ndarray:
        """Preprocess face for model"""
        face = cv2.resize(face, (48, 48))
        return face.astype(np.float32) / 255.0

    def _update_buffer(self, value: float):
        self.buffer.append(value)
        if len(self.buffer) > self.buffer_size:
            self.buffer.pop(0)

    def get_final_score(self) -> dict:
        """Return final analysis results"""
        if not self.buffer:
            return {'level': 'No data', 'score': 0.0, 'percent': 0.0}
            
        avg_score = np.mean(self.buffer)
        if avg_score < 0.3:
            level = "Low"
        elif avg_score < 0.7:
            level = "Medium"
        else:
            level = "High"
            
        return {
            'level': level,
            'score': round(avg_score, 2),
            'percent': round(avg_score * 100, 1)
        }

    def close(self):
        """Clean up resources"""
        if hasattr(self, 'face_detector'):
            self.face_detector.close()

def analyze_source(source, is_video_file=False, output_file=None):
    """Main analysis function"""
    analyzer = None
    try:
        analyzer = FatigueAnalyzer('neural_network/data/models/fatigue_model.keras')
        
        cap = cv2.VideoCapture(source if is_video_file else 0)
        if not cap.isOpened():
            raise ValueError("Не удалось открыть видео источник")
        
        # Get video properties
        frame_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        frame_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        
        out = None
        if output_file:
            fourcc = cv2.VideoWriter_fourcc(*'XVID')
            out = cv2.VideoWriter(output_file, fourcc, 30.0, 
                                (frame_width, frame_height))
        
        frame_count = 0
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break
                
            frame_count += 1
            processed = analyzer.process_frame(frame)
            
            if output_file and out:
                out.write(processed)
            
            # Показываем только для реального времени
            if not is_video_file:
                cv2.imshow('Analysis', processed)
                if cv2.waitKey(1) & 0xFF == ord('q'):
                    break
        
        cap.release()
        if out:
            out.release()
        cv2.destroyAllWindows()
        
        # Get final result
        result = analyzer.get_final_score()
        
        # Проверяем, было ли обнаружено лицо
        face_detected_ratio = analyzer.face_detected_frames / analyzer.total_frames if analyzer.total_frames > 0 else 0
        
        if face_detected_ratio == 0:
            return "Unknown", 0, {
                'level': 'Unknown',
                'score': 0.0,
                'percent': 0.0,
                'error': 'No face detected in video',
                'face_detected_ratio': 0,
                'frames_analyzed': analyzer.total_frames,
                'resolution': f"{frame_width}x{frame_height}",
                'fps': int(fps)
            }
        
        # Добавляем метаданные
        result['face_detected_ratio'] = face_detected_ratio
        result['frames_analyzed'] = analyzer.total_frames
        result['resolution'] = f"{frame_width}x{frame_height}"
        result['fps'] = int(fps)
        
        return result['level'], result['percent'], result
        
    except Exception as e:
        logger.error(f"Analysis error: {str(e)}")
        return "Unknown", 0, {
            'level': 'Unknown',
            'score': 0.0,
            'percent': 0.0,
            'error': str(e),
            'face_detected_ratio': 0,
            'frames_analyzed': 0
        }
    finally:
        if analyzer:
            analyzer.close()

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
