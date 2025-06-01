
import cv2
import numpy as np
import tensorflow as tf
import mediapipe as mp
import time
import os
from pathlib import Path
import logging
import argparse

# Configure detailed logging
logging.basicConfig(
    level=logging.INFO, 
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('neural_network_analysis.log', encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# MediaPipe инициализация с более мягкими настройками
mp_face_detection = mp.solutions.face_detection
mp_drawing = mp.solutions.drawing_utils

# Global analyzer instance for reuse
_GLOBAL_ANALYZER = None

def get_analyzer():
    """Returns the global analyzer instance, creating it if necessary"""
    global _GLOBAL_ANALYZER
    if _GLOBAL_ANALYZER is None:
        model_path = os.path.join('neural_network', 'data', 'models', 'fatigue_model.keras')
        if not os.path.exists(model_path):
            logger.error(f"Model not found at path: {model_path}")
            raise FileNotFoundError(f"Model not found at path: {model_path}")
        logger.info(f"Loading model from: {model_path}")
        _GLOBAL_ANALYZER = FatigueAnalyzer(model_path)
    return _GLOBAL_ANALYZER

class FatigueAnalyzer:
    def __init__(self, model_path: str, buffer_size: int = 15):
        logger.info(f"Initializing FatigueAnalyzer with model: {model_path}")
        try:
            self.model = tf.keras.models.load_model(model_path)
            logger.info("Model loaded successfully")
            logger.info(f"Model input shape: {self.model.input_shape}")
            logger.info(f"Model output shape: {self.model.output_shape}")
        except Exception as e:
            logger.error(f"Failed to load model: {e}")
            raise
            
        self.buffer = []
        self.buffer_size = buffer_size
        
        try:
            # Более мягкие настройки для лучшего обнаружения
            self.face_detection = mp_face_detection.FaceDetection(
                model_selection=0,  # 0 для близких лиц (2м), 1 для дальних (5м)
                min_detection_confidence=0.5  # Снижаем порог для лучшего обнаружения
            )
            logger.info("MediaPipe face detector initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize MediaPipe: {e}")
            raise
            
        self.last_face_time = time.time()
        self.face_detected_frames = 0
        self.total_frames = 0
        self.processing_times = []

    def process_frame(self, frame: np.ndarray, show_visualization: bool = False) -> np.ndarray:
        """Process frame with improved face detection"""
        start_time = time.time()
        self.total_frames += 1
        
        logger.debug(f"Processing frame {self.total_frames}, shape: {frame.shape}")
        
        # Convert BGR to RGB for MediaPipe (OpenCV uses BGR by default)
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        
        try:
            # Process with MediaPipe
            results = self.face_detection.process(rgb_frame)
            logger.debug(f"MediaPipe processing completed for frame {self.total_frames}")
        except Exception as e:
            logger.error(f"Face detection error on frame {self.total_frames}: {e}")
            return frame
        
        # Check if faces were detected
        if results.detections:
            self.last_face_time = time.time()
            self.face_detected_frames += 1
            
            logger.debug(f"Face detected in frame {self.total_frames}, detections: {len(results.detections)}")
            
            for detection in results.detections:
                try:
                    bbox = detection.location_data.relative_bounding_box
                    h, w = frame.shape[:2]
                    
                    # Конвертируем относительные координаты в абсолютные
                    x = max(0, int(bbox.xmin * w))
                    y = max(0, int(bbox.ymin * h))
                    width = min(w - x, int(bbox.width * w))
                    height = min(h - y, int(bbox.height * h))
                    
                    logger.debug(f"Face bbox: x={x}, y={y}, w={width}, h={height}")

                    if width > 20 and height > 20:  # Минимальный размер лица
                        try:
                            # Извлекаем область лица
                            face_roi = frame[y:y+height, x:x+width]
                            logger.debug(f"Face ROI shape: {face_roi.shape}")
                            
                            # Предобработка для модели (как при обучении)
                            processed = self._preprocess_face(face_roi)
                            logger.debug(f"Processed face shape: {processed.shape}")
                            
                            # Предсказание модели
                            prediction = self.model.predict(processed[None, ...], verbose=0)[0][0]
                            self._update_buffer(prediction)
                            
                            logger.debug(f"Fatigue prediction: {prediction:.3f}, buffer avg: {np.mean(self.buffer):.3f}")
                            
                            # Визуализация
                            if show_visualization:
                                avg_score = np.mean(self.buffer) if self.buffer else prediction
                                color = (0, 0, 255) if avg_score > 0.5 else (0, 255, 0)
                                
                                # Рисуем прямоугольник вокруг лица
                                cv2.rectangle(frame, (x, y), (x+width, y+height), color, 2)
                                
                                # Добавляем текст с результатом
                                cv2.putText(frame, f"Fatigue: {avg_score:.2f}", 
                                           (x, y-10), cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 2)
                                
                                # Добавляем confidence score
                                confidence = detection.score[0] if detection.score else 0
                                cv2.putText(frame, f"Conf: {confidence:.2f}", 
                                           (x, y+height+20), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 1)
                                
                        except Exception as e:
                            logger.error(f"Processing error for detection: {str(e)}")
                            continue
                        
                except Exception as e:
                    logger.error(f"Detection processing error: {str(e)}")
                    continue
        else:
            logger.debug(f"No face detected in frame {self.total_frames}")
            # Если долго нет лица, добавляем штрафной балл
            if time.time() - self.last_face_time > 2:
                self.buffer.append(1.0)
                logger.debug(f"No face detected for >2s, adding penalty score")
        
        processing_time = time.time() - start_time
        self.processing_times.append(processing_time)
        
        if len(self.processing_times) > 100:
            self.processing_times.pop(0)
        
        return frame

    def _preprocess_face(self, face: np.ndarray) -> np.ndarray:
        """Preprocess face exactly as during training"""
        logger.debug(f"Preprocessing face, original shape: {face.shape}")
        
        # Resize to 48x48 as model was trained
        face = cv2.resize(face, (48, 48))
        logger.debug(f"After resize: {face.shape}")
        
        # Convert to float32 and normalize to [0,1] as during training
        face = face.astype(np.float32) / 255.0
        logger.debug(f"After normalization: min={face.min():.3f}, max={face.max():.3f}")
        
        # If model expects grayscale but we have color, convert
        if len(face.shape) == 3 and face.shape[2] == 3:
            # Check if model expects grayscale (single channel)
            expected_shape = self.model.input_shape
            if len(expected_shape) == 4 and expected_shape[-1] == 1:
                face = cv2.cvtColor(face, cv2.COLOR_BGR2GRAY)
                face = np.expand_dims(face, axis=-1)
                logger.debug(f"Converted to grayscale: {face.shape}")
        
        return face

    def _update_buffer(self, value: float):
        self.buffer.append(value)
        if len(self.buffer) > self.buffer_size:
            self.buffer.pop(0)

    def get_final_score(self) -> dict:
        """Return final analysis results"""
        if not self.buffer:
            return {
                'level': 'No data', 
                'score': 0.0, 
                'percent': 0.0,
                'face_detection_rate': 0,
                'avg_processing_time': 0
            }
            
        avg_score = np.mean(self.buffer)
        if avg_score < 0.3:
            level = "Low"
        elif avg_score < 0.7:
            level = "Medium"
        else:
            level = "High"
        
        # Calculate statistics
        avg_processing_time = np.mean(self.processing_times) if self.processing_times else 0
        face_detection_rate = self.face_detected_frames / self.total_frames if self.total_frames > 0 else 0
        
        logger.info(f"Final analysis - Level: {level}, Score: {avg_score:.3f}")
        logger.info(f"Face detection rate: {face_detection_rate:.3f} ({self.face_detected_frames}/{self.total_frames})")
        logger.info(f"Average processing time: {avg_processing_time:.3f}s")
            
        return {
            'level': level,
            'score': round(avg_score, 2),
            'percent': round(avg_score * 100, 1),
            'face_detection_rate': face_detection_rate,
            'avg_processing_time': avg_processing_time
        }

    def close(self):
        """Clean up resources"""
        logger.info("Closing FatigueAnalyzer")
        if hasattr(self, 'face_detection'):
            self.face_detection.close()

def analyze_source(source, is_video_file=False, output_file=None):
    """Main analysis function"""
    logger.info(f"Starting analysis - Source: {source}, Video file: {is_video_file}")
    
    analyzer = None
    try:
        analyzer = FatigueAnalyzer('neural_network/data/models/fatigue_model.keras')
        
        cap = cv2.VideoCapture(source if is_video_file else 0)
        if not cap.isOpened():
            error_msg = f"Failed to open video source: {source}"
            logger.error(error_msg)
            raise ValueError(error_msg)
        
        # Get video properties
        frame_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        frame_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        
        logger.info(f"Video properties - Resolution: {frame_width}x{frame_height}, FPS: {fps}")
        
        out = None
        if output_file:
            fourcc = cv2.VideoWriter_fourcc(*'mp4v')
            out = cv2.VideoWriter(output_file, fourcc, 20.0, 
                                (frame_width, frame_height))
            logger.info(f"Output video writer initialized: {output_file}")
        
        frame_count = 0
        start_time = time.time()
        
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                logger.info("End of video stream")
                break
                
            frame_count += 1
            processed = analyzer.process_frame(frame, show_visualization=True)
            
            if output_file and out:
                out.write(processed)
            
            # Показываем для всех режимов если это не видеофайл
            if not is_video_file:
                cv2.imshow('Fatigue Analysis', processed)
                if cv2.waitKey(1) & 0xFF == ord('q'):
                    logger.info("User pressed 'q', stopping analysis")
                    break
        
        total_time = time.time() - start_time
        logger.info(f"Analysis completed - Processed {frame_count} frames in {total_time:.2f}s")
        
        cap.release()
        if out:
            out.release()
        cv2.destroyAllWindows()
        
        # Get final result
        result = analyzer.get_final_score()
        
        # Проверяем обнаружение лица
        face_detected_ratio = result.get('face_detection_rate', 0)
        
        if face_detected_ratio == 0:
            logger.warning("No face detected in entire video")
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
        
        logger.info(f"Analysis result: {result}")
        return result['level'], result['percent'], result
        
    except Exception as e:
        logger.error(f"Analysis error: {str(e)}", exc_info=True)
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

def real_time_test():
    """Функция для тестирования в реальном времени с улучшенной диагностикой"""
    print("=== ТЕСТ АНАЛИЗА УСТАЛОСТИ В РЕАЛЬНОМ ВРЕМЕНИ ===")
    print("Инструкции:")
    print("- Убедитесь, что камера подключена")
    print("- Расположите лицо по центру экрана")
    print("- Обеспечьте хорошее освещение")
    print("- Нажмите 'q' для выхода")
    print("- Нажмите 's' для сохранения скриншота")
    print("- Нажмите 'd' для включения отладочной информации")
    print("=" * 50)
    
    logger.info("Starting real-time fatigue analysis test")
    
    try:
        analyzer = FatigueAnalyzer('neural_network/data/models/fatigue_model.keras')
        
        cap = cv2.VideoCapture(0)
        if not cap.isOpened():
            print("ОШИБКА: Не удалось открыть камеру")
            return
        
        # Настройки камеры
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
        cap.set(cv2.CAP_PROP_FPS, 30)
        
        # Проверяем реальные настройки камеры
        actual_width = cap.get(cv2.CAP_PROP_FRAME_WIDTH)
        actual_height = cap.get(cv2.CAP_PROP_FRAME_HEIGHT)
        actual_fps = cap.get(cv2.CAP_PROP_FPS)
        
        print(f"Камера инициализирована: {actual_width}x{actual_height} @ {actual_fps} FPS")
        logger.info(f"Camera initialized: {actual_width}x{actual_height} @ {actual_fps} FPS")
        
        frame_count = 0
        fps_counter = 0
        fps_start_time = time.time()
        current_fps = 0
        debug_mode = False
        
        print("Камера запущена. Смотрите в окно 'Fatigue Analysis Test'")
        
        while True:
            ret, frame = cap.read()
            if not ret:
                print("Не удалось получить кадр с камеры")
                break
            
            frame_count += 1
            fps_counter += 1
            
            # Обрабатываем кадр с визуализацией
            processed_frame = analyzer.process_frame(frame, show_visualization=True)
            
            # Добавляем информационную панель
            h, w = processed_frame.shape[:2]
            info_panel = np.zeros((140, w, 3), dtype=np.uint8)
            
            # Получаем статистику
            current_score = np.mean(analyzer.buffer) if analyzer.buffer else 0
            detection_rate = analyzer.face_detected_frames / analyzer.total_frames if analyzer.total_frames > 0 else 0
            
            # Рассчитываем FPS
            if time.time() - fps_start_time >= 1.0:
                current_fps = fps_counter
                fps_counter = 0
                fps_start_time = time.time()
            
            # Добавляем текст на панель
            cv2.putText(info_panel, f"Fatigue Score: {current_score:.3f}", 
                       (10, 25), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
            cv2.putText(info_panel, f"Detection Rate: {detection_rate:.1%}", 
                       (10, 50), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
            cv2.putText(info_panel, f"FPS: {current_fps}", 
                       (10, 75), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
            cv2.putText(info_panel, f"Frames: {analyzer.total_frames} | Faces: {analyzer.face_detected_frames}", 
                       (10, 100), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
            
            # Статус
            status_color = (0, 255, 0) if detection_rate > 0.5 else (0, 165, 255) if detection_rate > 0 else (0, 0, 255)
            status_text = "GOOD" if detection_rate > 0.5 else "DETECTING..." if detection_rate > 0 else "NO FACE"
            cv2.putText(info_panel, f"Status: {status_text}", 
                       (w-200, 25), cv2.FONT_HERSHEY_SIMPLEX, 0.7, status_color, 2)
            
            # Debug режим
            if debug_mode:
                cv2.putText(info_panel, f"Debug: ON", 
                           (w-200, 50), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 255), 1)
            
            # Объединяем кадр и панель
            combined = np.vstack([processed_frame, info_panel])
            cv2.imshow('Fatigue Analysis Test', combined)
            
            key = cv2.waitKey(1) & 0xFF
            if key == ord('q'):
                print("Выход по запросу пользователя")
                break
            elif key == ord('s'):
                screenshot_name = f"fatigue_test_screenshot_{int(time.time())}.jpg"
                cv2.imwrite(screenshot_name, combined)
                print(f"Скриншот сохранен: {screenshot_name}")
            elif key == ord('d'):
                debug_mode = not debug_mode
                if debug_mode:
                    logger.setLevel(logging.DEBUG)
                    print("DEBUG режим включен")
                else:
                    logger.setLevel(logging.INFO)
                    print("DEBUG режим выключен")
        
        # Финальная статистика
        print("\n=== ФИНАЛЬНАЯ СТАТИСТИКА ===")
        final_result = analyzer.get_final_score()
        print(f"Уровень усталости: {final_result.get('level', 'Unknown')}")
        print(f"Оценка: {final_result.get('score', 0):.3f}")
        print(f"Процент: {final_result.get('percent', 0):.1f}%")
        print(f"Частота обнаружения лица: {final_result.get('face_detection_rate', 0):.1%}")
        print(f"Среднее время обработки кадра: {final_result.get('avg_processing_time', 0):.3f}s")
        
        cap.release()
        cv2.destroyAllWindows()
        analyzer.close()
        
    except Exception as e:
        logger.error(f"Error in real-time test: {e}", exc_info=True)
        print(f"Ошибка: {e}")

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Fatigue Analysis Tool')
    parser.add_argument('--mode', choices=['video', 'realtime', 'test'], required=True,
                       help='Analysis mode: video file, realtime camera, or test interface')
    parser.add_argument('--input', help='Path to input video (for video mode)')
    parser.add_argument('--output', help='Path to output video')
    args = parser.parse_args()
    
    if args.mode == 'test':
        real_time_test()
    elif args.mode == 'video':
        if not args.input:
            print("Error: Input video required for video mode")
            print("Usage: python predict.py --mode video --input path/to/video.mp4")
            exit(1)
            
        level, percent, details = analyze_source(
            source=args.input,
            is_video_file=True,
            output_file=args.output
        )
        
        print(f"Fatigue Level: {level}")
        print(f"Fatigue Percentage: {percent}%")
        if 'error' in details and details['error']:
            print(f"Error: {details['error']}")
    elif args.mode == 'realtime':
        level, percent, details = analyze_source(
            source=0,
            is_video_file=False,
            output_file=args.output
        )
        
        print(f"Fatigue Level: {level}")
        print(f"Fatigue Percentage: {percent}%")
        if 'error' in details and details['error']:
            print(f"Error: {details['error']}")
