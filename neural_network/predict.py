
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
FaceDetection = mp_face_detection.FaceDetection

# Глобальный экземпляр анализатора для повторного использования
_GLOBAL_ANALYZER = None

def get_analyzer():
    """Возвращает глобальный экземпляр анализатора, создавая его при необходимости"""
    global _GLOBAL_ANALYZER
    if _GLOBAL_ANALYZER is None:
        model_path = os.path.join('neural_network', 'data', 'models', 'fatigue_model.keras')
        if not os.path.exists(model_path):
            raise FileNotFoundError(f"Модель не найдена по пути: {model_path}")
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
        self.load_resources()
    
    def load_resources(self):
        """Загружает модель и инициализирует детектор лиц"""
        try:
            self.model = tf.keras.models.load_model(self.model_path)
            # Используем более высокий показатель уверенности для более точного определения лиц
            self.face_detector = FaceDetection(min_detection_confidence=0.5)
            logger.info("Модель и детектор лиц успешно загружены")
        except Exception as e:
            logger.error(f"Ошибка при загрузке ресурсов: {e}")
            raise

    def process_frame(self, frame: np.ndarray) -> np.ndarray:
        """Обрабатывает кадр, отрисовывая визуализацию усталости"""
        if self.model is None or self.face_detector is None:
            try:
                self.load_resources()
            except Exception as e:
                logger.error(f"Не удалось загрузить модель: {e}")
                return frame
        
        try:
            # Ensure the frame is not empty and is valid
            if frame is None or frame.size == 0 or not isinstance(frame, np.ndarray):
                logger.warning("Empty or invalid frame received")
                return frame

            # Создаем копию кадра для анализа и отрисовки визуализации
            output_frame = frame.copy()
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
                            
                            # Определяем цвет на основе уровня усталости
                            color = (0, 0, 255) if prediction > 0.65 else ((0, 165, 255) if prediction > 0.4 else (0, 255, 0))
                            
                            # Отрисовка рамки вокруг лица
                            cv2.rectangle(output_frame, (x, y), (x+width, y+height), color, 2)
                            
                            # Отрисовка текущего значения усталости
                            text = f"Fatigue: {prediction:.2f}"
                            cv2.putText(output_frame, text, (x, y-10), cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 2)
                            
                            # Добавляем среднее значение усталости из буфера
                            mean_fatigue = np.mean(self.buffer)
                            level_text = "High" if mean_fatigue > 0.65 else ("Medium" if mean_fatigue > 0.4 else "Low")
                            mean_text = f"Avg: {mean_fatigue:.2f} ({level_text})"
                            cv2.putText(output_frame, mean_text, (x, y+height+25), 
                                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 2)
                        except Exception as e:
                            logger.error(f"Ошибка обработки лица: {str(e)}")
            else:
                if time.time() - self.last_face_time > 2:
                    self._update_buffer(0.5)  # Предполагаем среднюю усталость, если лицо не обнаружено
                # Добавляем сообщение о том, что лицо не обнаружено
                cv2.putText(output_frame, "No face detected", (20, 50), 
                            cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)
            
            # Добавляем информацию о буфере оценки
            buffer_info = f"Buffer: {len(self.buffer)}/{self.buffer_size}"
            cv2.putText(output_frame, buffer_info, (20, 20), 
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
            
        except Exception as e:
            logger.error(f"Ошибка обработки кадра: {str(e)}")
            # При ошибке добавляем сообщение об ошибке на кадр
            cv2.putText(output_frame, f"Error: {str(e)[:30]}...", (20, 50), 
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
            
        # Возвращаем обработанный кадр с визуализацией
        return output_frame

    def _preprocess_face(self, face: np.ndarray) -> np.ndarray:
        face = cv2.resize(face, (48, 48))
        return face.astype(np.float32) / 255.0

    def _update_buffer(self, value: float):
        self.buffer.append(value)
        if len(self.buffer) > self.buffer_size:
            self.buffer.pop(0)

    def get_final_score(self) -> dict:
        if not self.buffer:
            return {'level': 'Medium', 'score': 0.5, 'percent': 50.0}
            
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
            'percent': round(avg_score * 100, 1)
        }
    
    def reset_buffer(self):
        """Сбрасывает буфер для нового анализа"""
        self.buffer = []

def analyze_source(source, is_video_file=False, output_file=None):
    try:
        # Используем общий анализатор
        analyzer = get_analyzer()
        analyzer.reset_buffer()
        
        if is_video_file and not os.path.exists(source):
            raise FileNotFoundError(f"Видеофайл не найден: {source}")
        
        cap = cv2.VideoCapture(source if is_video_file else 0)
        if not cap.isOpened():
            raise ValueError("Не удалось открыть видео источник")
        
        # Подготовим видеописатель для выходного файла
        if output_file:
            fourcc = cv2.VideoWriter_fourcc(*'XVID')
            frame_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            frame_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            fps = 30.0  # Фиксированный FPS для выходного файла
            out = cv2.VideoWriter(output_file, fourcc, fps, 
                                (frame_width, frame_height))
        
        frame_count = 0
        max_frames = 300  # Максимум 10 секунд при 30 fps
        
        while cap.isOpened() and frame_count < max_frames:
            ret, frame = cap.read()
            if not ret:
                break
                
            # Анализируем кадр с отрисовкой визуализации
            processed_frame = analyzer.process_frame(frame)
            frame_count += 1
            
            # Записываем кадр с визуализацией
            if output_file and 'out' in locals():
                out.write(processed_frame)
            
            # Показываем кадры только в режиме отладки
            if not is_video_file:
                cv2.imshow('Analysis', processed_frame)
                if cv2.waitKey(1) & 0xFF == ord('q'):
                    break
        
        cap.release()
        if output_file and 'out' in locals():
            out.release()
        cv2.destroyAllWindows()
        
        result = analyzer.get_final_score()
        logger.info(f"Анализ завершен: уровень={result['level']}, процент={result['percent']}")
        return result['level'], result['percent']
    except Exception as e:
        logger.error(f"Ошибка анализа видео: {str(e)}")
        # В случае ошибки возвращаем средний уровень усталости
        return "Medium", 50

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
