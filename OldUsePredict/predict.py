import cv2
import numpy as np
import tensorflow as tf
import mediapipe as mp
import time
from pathlib import Path

mp_face_detection = mp.solutions.face_detection
FaceDetection = mp_face_detection.FaceDetection

class FatigueAnalyzer:
    def __init__(self, model_path: str, buffer_size: int = 15):
        self.model = tf.keras.models.load_model(model_path)
        self.buffer = []
        self.buffer_size = buffer_size
        self.face_detector = FaceDetection(min_detection_confidence=0.7)
        self.last_face_time = time.time()

    def process_frame(self, frame: np.ndarray) -> np.ndarray:
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = self.face_detector.process(rgb_frame)
        
        if results.detections:
            self.last_face_time = time.time()
            for detection in results.detections:
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
                    try:
                        face_roi = frame[y:y+height, x:x+width]
                        processed = self._preprocess_face(face_roi)
                        prediction = self.model.predict(processed[None, ...], verbose=0)[0][0]
                        self._update_buffer(prediction)
                        
                        color = (0, 0, 255) if prediction > 0.5 else (0, 255, 0)
                        cv2.rectangle(frame, (x, y), (x+width, y+height), color, 2)
                        cv2.putText(frame, f"Fatigue: {np.mean(self.buffer):.2f}", 
                                   (x, y-10), cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 2)
                    except Exception as e:
                        print(f"Processing error: {str(e)}")
        else:
            if time.time() - self.last_face_time > 2:
                self.buffer.append(1.0)
        
        return frame

    def _preprocess_face(self, face: np.ndarray) -> np.ndarray:
        face = cv2.resize(face, (48, 48))
        return face.astype(np.float32) / 255.0

    def _update_buffer(self, value: float):
        self.buffer.append(value)
        if len(self.buffer) > self.buffer_size:
            self.buffer.pop(0)

    def get_final_score(self) -> dict:
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

def analyze_source(source, is_video_file=False, output_file=None):
    analyzer = FatigueAnalyzer('neural_network/data/models/fatigue_model.keras')
    
    cap = cv2.VideoCapture(source if is_video_file else 0)
    if not cap.isOpened():
        raise ValueError("Не удалось открыть видео источник")
    
    if output_file:
        fourcc = cv2.VideoWriter_fourcc(*'XVID')
        out = cv2.VideoWriter(output_file, fourcc, 30.0, 
                            (int(cap.get(3)), int(cap.get(4))))
    
    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break
            
        processed = analyzer.process_frame(frame)
        
        if output_file:
            out.write(processed)
        
        cv2.imshow('Analysis', processed)
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break
    
    cap.release()
    if output_file:
        out.release()
    cv2.destroyAllWindows()
    
    result = analyzer.get_final_score()
    return result['level'], result['percent']

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
        
    level, percent = analyze_source(
        source=args.input if args.mode == 'video' else 0,
        is_video_file=args.mode == 'video',
        output_file=args.output
    )
    
    print(f"Fatigue Level: {level}")
    print(f"Fatigue Percentage: {percent}%")