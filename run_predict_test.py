
#!/usr/bin/env python3
"""
Скрипт для тестирования системы анализа усталости
Использование:
    python run_predict_test.py          # Интерактивный тест с камерой
    python run_predict_test.py --help   # Показать справку
"""

import sys
import os
import subprocess

def main():
    print("=== ТЕСТИРОВАНИЕ СИСТЕМЫ АНАЛИЗА УСТАЛОСТИ ===")
    print()
    print("Этот скрипт запустит интерактивное тестирование анализа усталости")
    print("с использованием вашей камеры в реальном времени.")
    print()
    print("Требования:")
    print("- Подключенная камера")
    print("- Установленные зависимости (см. requirements.txt)")
    print("- Модель нейросети в neural_network/data/models/fatigue_model.keras")
    print()
    
    # Проверяем наличие модели
    model_path = os.path.join('neural_network', 'data', 'models', 'fatigue_model.keras')
    if not os.path.exists(model_path):
        print(f"ОШИБКА: Модель не найдена по пути: {model_path}")
        print("Убедитесь, что модель нейросети находится в правильном месте.")
        return 1
    
    # Проверяем наличие predict.py
    predict_path = os.path.join('neural_network', 'predict.py')
    if not os.path.exists(predict_path):
        print(f"ОШИБКА: Файл predict.py не найден: {predict_path}")
        return 1
    
    print("✓ Модель найдена")
    print("✓ Predict.py найден")
    print()
    
    response = input("Запустить тестирование? (y/N): ").lower().strip()
    if response not in ['y', 'yes', 'да', 'д']:
        print("Тестирование отменено")
        return 0
    
    print()
    print("Запуск тестирования...")
    print("(Для выхода нажмите 'q' в окне камеры)")
    print()
    
    try:
        # Запускаем predict.py в режиме тестирования
        result = subprocess.run([
            sys.executable, 
            predict_path, 
            '--mode', 'test'
        ], cwd=os.getcwd())
        
        return result.returncode
        
    except KeyboardInterrupt:
        print("\nТестирование прервано пользователем")
        return 0
    except Exception as e:
        print(f"\nОшибка при запуске тестирования: {e}")
        return 1

if __name__ == '__main__':
    if '--help' in sys.argv or '-h' in sys.argv:
        print(__doc__)
        print("\nДополнительные команды:")
        print("  python neural_network/predict.py --mode test     # Прямой запуск теста")
        print("  python neural_network/predict.py --mode video --input path/to/video.mp4  # Анализ видеофайла")
        print("  python neural_network/predict.py --mode realtime # Анализ с камеры без интерфейса")
        sys.exit(0)
    
    sys.exit(main())
