
import React, { useRef, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Video, Play, Square, Eye, Brain, Activity } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

interface PredictTestProps {
  onClose?: () => void;
}

export const PredictTest: React.FC<PredictTestProps> = ({ onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isActive, setIsActive] = useState(false);
  const [fatigueLevel, setFatigueLevel] = useState(0);
  const [faceDetected, setFaceDetected] = useState(false);
  const [fps, setFps] = useState(0);
  const [frameCount, setFrameCount] = useState(0);
  const animationRef = useRef<number>();
  const lastTimeRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);

  // Симуляция анализа усталости (в реальной версии здесь был бы вызов нейросети)
  const analyzeFrame = (videoElement: HTMLVideoElement, canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Рисуем текущий кадр
    ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
    
    // Симуляция детекции лица (случайное значение для демо)
    const mockFaceDetected = Math.random() > 0.3;
    setFaceDetected(mockFaceDetected);

    if (mockFaceDetected) {
      // Рисуем прямоугольник вокруг "лица" (для демо - в центре)
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const faceWidth = 200;
      const faceHeight = 250;
      
      const x = centerX - faceWidth / 2;
      const y = centerY - faceHeight / 2;

      // Генерируем случайный уровень усталости
      const mockFatigue = Math.random();
      setFatigueLevel(mockFatigue);

      // Цвет рамки зависит от уровня усталости
      const color = mockFatigue > 0.7 ? '#ef4444' : mockFatigue > 0.4 ? '#f59e0b' : '#22c55e';
      
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, faceWidth, faceHeight);

      // Добавляем текст с уровнем усталости
      ctx.fillStyle = color;
      ctx.font = 'bold 16px Arial';
      ctx.fillText(`Усталость: ${Math.round(mockFatigue * 100)}%`, x, y - 10);
      
      // Добавляем индикатор состояния
      const status = mockFatigue > 0.7 ? 'Высокая' : mockFatigue > 0.4 ? 'Средняя' : 'Низкая';
      ctx.fillText(`Состояние: ${status}`, x, y - 30);
    }

    // Обновляем счетчик кадров
    setFrameCount(prev => prev + 1);
  };

  const processFrame = (timestamp: number) => {
    if (lastTimeRef.current !== 0) {
      const delta = timestamp - lastTimeRef.current;
      setFps(Math.round(1000 / delta));
    }
    lastTimeRef.current = timestamp;

    if (videoRef.current && canvasRef.current && isActive) {
      analyzeFrame(videoRef.current, canvasRef.current);
    }

    if (isActive) {
      animationRef.current = requestAnimationFrame(processFrame);
    }
  };

  const startTest = async () => {
    try {
      console.log('[PredictTest] Запуск теста predict...');
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          width: { ideal: 640, max: 1280 },
          height: { ideal: 480, max: 720 },
          facingMode: 'user'
        }
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          if (canvasRef.current && videoRef.current) {
            canvasRef.current.width = videoRef.current.videoWidth;
            canvasRef.current.height = videoRef.current.videoHeight;
          }
        };
      }

      setIsActive(true);
      setFrameCount(0);
      animationRef.current = requestAnimationFrame(processFrame);

      toast({
        title: "Тест запущен",
        description: "Тестирование predict функционала активно",
      });

      console.log('[PredictTest] Тест успешно запущен');
    } catch (error) {
      console.error('[PredictTest] Ошибка при запуске теста:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось получить доступ к камере",
        variant: "destructive"
      });
    }
  };

  const stopTest = () => {
    console.log('[PredictTest] Остановка теста...');
    
    setIsActive(false);
    
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    toast({
      title: "Тест остановлен",
      description: "Тестирование predict функционала завершено",
    });

    console.log(`[PredictTest] Тест остановлен. Обработано кадров: ${frameCount}`);
  };

  // Очистка при размонтировании
  useEffect(() => {
    return () => {
      if (isActive) {
        stopTest();
      }
    };
  }, []);

  const getFatigueColor = (level: number) => {
    if (level > 0.7) return 'text-red-500';
    if (level > 0.4) return 'text-yellow-500';
    return 'text-green-500';
  };

  const getFatigueStatus = (level: number) => {
    if (level > 0.7) return 'Высокая усталость';
    if (level > 0.4) return 'Средняя усталость';
    return 'Низкая усталость';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Тест Predict Функционала</h2>
          <p className="text-muted-foreground">
            Реальное время анализа с визуализацией детекции лица и уровня усталости
          </p>
        </div>
        {onClose && (
          <Button variant="outline" onClick={onClose}>
            Закрыть
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Видео и канвас */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Video className="h-5 w-5" />
              Видеопоток с анализом
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative">
              {/* Скрытое видео */}
              <video 
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="hidden"
              />
              
              {/* Канвас для отображения результатов */}
              <canvas 
                ref={canvasRef}
                className="w-full rounded-lg bg-black aspect-video"
                style={{ maxHeight: '400px' }}
              />
              
              {isActive && (
                <div className="absolute top-2 right-2 bg-red-500 text-white px-2 py-1 rounded text-xs font-medium flex items-center gap-1">
                  <span className="animate-pulse">●</span>
                  LIVE
                </div>
              )}
            </div>

            <div className="mt-4 flex gap-2">
              {!isActive ? (
                <Button onClick={startTest} className="flex-1">
                  <Play className="mr-2 h-4 w-4" />
                  Запустить тест
                </Button>
              ) : (
                <Button onClick={stopTest} variant="destructive" className="flex-1">
                  <Square className="mr-2 h-4 w-4" />
                  Остановить тест
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Панель статистики */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Детекция лица
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center">
                <div className={`w-4 h-4 rounded-full mr-2 ${faceDetected ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className={faceDetected ? 'text-green-600' : 'text-red-600'}>
                  {faceDetected ? 'Лицо обнаружено' : 'Лицо не найдено'}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                Уровень усталости
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center">
                <div className={`text-3xl font-bold ${getFatigueColor(fatigueLevel)}`}>
                  {Math.round(fatigueLevel * 100)}%
                </div>
                <div className={`text-sm ${getFatigueColor(fatigueLevel)}`}>
                  {getFatigueStatus(fatigueLevel)}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Статистика
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">FPS:</span>
                <span className="font-medium">{fps}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Кадров:</span>
                <span className="font-medium">{frameCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Статус:</span>
                <span className={`font-medium ${isActive ? 'text-green-600' : 'text-gray-600'}`}>
                  {isActive ? 'Активен' : 'Остановлен'}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
