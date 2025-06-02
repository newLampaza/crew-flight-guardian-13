import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { StarRating } from './StarRating';
import { cn } from '@/lib/utils';
import { FileVideo, Video, RefreshCcw, AlertCircle, User } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface AnalysisResultProps {
  analysisResult: {
    analysis_id?: number;
    fatigue_level?: string;
    neural_network_score?: number;
    analysis_date?: string;
    video_path?: string;
    from_code?: string;
    to_code?: string;
    error?: string;
    face_detection_ratio?: number;
    frames_analyzed?: number;
    resolution?: string;
    fps?: number;
  };
  feedbackScore: number;
  setFeedbackScore: (score: number) => void;
  onClose: () => void;
  onSubmitFeedback: () => void;
}

export const AnalysisResult: React.FC<AnalysisResultProps> = ({
  analysisResult,
  feedbackScore,
  setFeedbackScore,
  onClose,
  onSubmitFeedback
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [videoAttempts, setVideoAttempts] = useState(0);

  const getFatigueLevel = (level?: string) => {
    switch (level?.toLowerCase()) {
      case 'high': return 'Высокий';
      case 'medium': return 'Средний';
      case 'low': return 'Низкий';
      case 'unknown': return 'Не определен';
      default: return 'Нет данных';
    }
  };
  
  const getFatigueLevelClass = (level?: string) => {
    switch (level?.toLowerCase()) {
      case 'high': return 'text-rose-500';
      case 'medium': return 'text-amber-500';
      case 'low': return 'text-emerald-500';
      default: return 'text-slate-500';
    }
  };

  // Improved video URL formatting
  const formatVideoUrl = (path?: string) => {
    if (!path) return '';
    
    // Replace backslashes with forward slashes
    const normalizedPath = path.replace(/\\/g, '/');
    
    // Check if path is an absolute URL
    if (normalizedPath.startsWith('http')) {
      return normalizedPath;
    }
    
    // Use only the file name for simplified access via API
    const fileName = normalizedPath.split('/').pop();
    
    // Form full URL to API endpoint with cache busting
    const apiBase = import.meta.env.PROD ? '/api' : 'http://localhost:5000/api';
    const timestamp = Date.now();
    return `${apiBase}/videos/${fileName}?t=${timestamp}`;
  };

  const reloadVideo = () => {
    if (videoRef.current && analysisResult?.video_path) {
      setIsLoading(true);
      setVideoError(null);
      setVideoAttempts(prev => prev + 1);
      
      const videoUrl = formatVideoUrl(analysisResult.video_path);
      console.log(`Reloading video (attempt ${videoAttempts + 1}):`, videoUrl);
      
      videoRef.current.src = videoUrl;
      videoRef.current.load();
    }
  };

  // Load video when analysisResult updates
  useEffect(() => {
    if (analysisResult?.video_path && videoRef.current) {
      const videoUrl = formatVideoUrl(analysisResult.video_path);
      console.log('Loading visualization video:', videoUrl);
      
      videoRef.current.src = videoUrl;
      videoRef.current.load();
      setIsLoading(true);
      setVideoError(null);
      setVideoAttempts(0);
    }
  }, [analysisResult?.video_path]);

  // Show toast notification about video path
  useEffect(() => {
    if (analysisResult?.video_path) {
      toast({
        title: "Видео с анализом сохранено",
        description: `Запись доступна по пути: ${analysisResult.video_path}`,
        variant: "info",
        action: (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => {
              navigator.clipboard.writeText(analysisResult.video_path || '');
              toast({
                title: "Скопировано",
                description: "Путь к видео скопирован в буфер обмена",
                duration: 2000
              });
            }}
          >
            Копировать
          </Button>
        )
      });
    }
  }, [analysisResult?.video_path]);

  const hasFaceDetectionError = () => {
    if (!analysisResult) return false;
    
    if (analysisResult.error && analysisResult.error.toLowerCase().includes('face')) {
      return true;
    }
    
    if (analysisResult.face_detection_ratio === 0) {
      return true;
    }
    
    return (analysisResult.fatigue_level === 'Unknown' && 
           analysisResult.neural_network_score === 0);
  };

  const handleVideoError = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    console.error("Video loading error:", e);
    setIsLoading(false);
    
    const errorMsg = videoAttempts < 2 
      ? "Не удалось загрузить видео. Попробуем ещё раз..."
      : "Видео недоступно. Возможно, файл повреждён или сервер недоступен.";
    
    setVideoError(errorMsg);
    
    if (videoAttempts < 2) {
      // Automatic retry after 2 seconds
      setTimeout(() => {
        reloadVideo();
      }, 2000);
    } else {
      toast({
        title: "Ошибка загрузки видео",
        description: "Не удалось загрузить видеозапись после нескольких попыток.",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="space-y-4">
      {hasFaceDetectionError() && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Ошибка распознавания лица</AlertTitle>
          <AlertDescription>
            {analysisResult.error || 'Лицо не обнаружено в видео. Убедитесь, что лицо хорошо освещено и находится в кадре.'}
          </AlertDescription>
        </Alert>
      )}
      
      <div className="flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-900 rounded-lg">
        <span className="text-muted-foreground">ID анализа:</span>
        <strong>#{analysisResult.analysis_id || 'неизвестно'}</strong>
      </div>
      
      <div className="flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-900 rounded-lg">
        <span className="text-muted-foreground">Уровень усталости:</span>
        <strong className={getFatigueLevelClass(analysisResult.fatigue_level)}>
          {getFatigueLevel(analysisResult.fatigue_level)}
        </strong>
      </div>

      {!hasFaceDetectionError() && (
        <div className="flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-900 rounded-lg">
          <span className="text-muted-foreground">Точность модели:</span>
          <div className="relative w-20 h-20">
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="40"
                cy="40"
                r="36"
                stroke="currentColor"
                strokeWidth="8"
                fill="none"
                className="text-muted/20"
              />
              <circle
                cx="40"
                cy="40"
                r="36"
                stroke="currentColor"
                strokeWidth="8"
                fill="none"
                strokeDasharray={226.1946}
                strokeDashoffset={226.1946 - (226.1946 * (analysisResult.neural_network_score || 0))}
                className={cn(
                  'transition-all duration-1000',
                  (analysisResult.neural_network_score || 0) > 0.65 ? 'text-rose-500' : 
                  (analysisResult.neural_network_score || 0) > 0.4 ? 'text-amber-500' : 
                  'text-emerald-500'
                )}
              />
            </svg>
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
              <span className="text-lg font-bold">
                {Math.round((analysisResult.neural_network_score || 0) * 100)}%
              </span>
            </div>
          </div>
        </div>
      )}

      {!hasFaceDetectionError() && (
        <div className="flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-900 rounded-lg">
          <span className="text-muted-foreground">Оценка системы:</span>
          <StarRating currentRating={feedbackScore} onRatingChange={setFeedbackScore} />
        </div>
      )}

      {analysisResult.video_path && (
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Video className="h-5 w-5 text-primary" />
              <h4 className="text-sm font-medium">
                {hasFaceDetectionError() 
                  ? "Видео (лицо не обнаружено)" 
                  : "Визуализация анализа нейросети:"}
              </h4>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={reloadVideo}
              disabled={isLoading && !videoError}
            >
              <RefreshCcw className="h-4 w-4 mr-1" /> 
              Обновить ({videoAttempts}/3)
            </Button>
          </div>
          
          <div className="relative">
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-md z-10">
                <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full"></div>
              </div>
            )}
            
            <video 
              ref={videoRef}
              controls 
              className="w-full rounded-md bg-black aspect-video"
              aria-label="Видео с камеры для анализа усталости"
              playsInline
              crossOrigin="anonymous"
              onLoadedData={() => {
                setIsLoading(false);
                setVideoError(null);
                console.log('Video loaded successfully');
              }}
              onError={handleVideoError}
            />
            
            <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
              <FileVideo className="h-3 w-3" />
              <span>{hasFaceDetectionError() ? "Оригинальное видео" : "Анализ нейросети"}</span>
            </div>

            {hasFaceDetectionError() && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="bg-black/50 px-6 py-4 rounded-lg text-white text-center max-w-md">
                  <User className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <h3 className="text-xl font-bold mb-2">Лицо не обнаружено</h3>
                  <p className="text-sm">
                    Не удалось обнаружить лицо в кадре. Убедитесь, что лицо хорошо освещено 
                    и находится в пределах кадра.
                  </p>
                </div>
              </div>
            )}
          </div>
          
          {videoError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                {videoError}
                {videoAttempts >= 2 && (
                  <div className="mt-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={reloadVideo}
                      className="text-xs"
                    >
                      Попробовать снова
                    </Button>
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
            <div className="bg-muted/20 p-3 rounded-md border border-dashed text-xs text-muted-foreground">
              <strong className="block mb-1">Расположение видео:</strong>
              <code className="break-all">{analysisResult.video_path}</code>
            </div>

            <div className="bg-muted/20 p-3 rounded-md border border-dashed text-xs text-muted-foreground">
              <strong className="block mb-1">Технические детали:</strong>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                <div>Разрешение:</div>
                <div>{analysisResult.resolution || 'неизвестно'}</div>
                <div>FPS:</div>
                <div>{analysisResult.fps || 'неизвестно'}</div>
                {analysisResult.face_detection_ratio !== undefined && (
                  <>
                    <div>Обнаружение лица:</div>
                    <div>{Math.round(analysisResult.face_detection_ratio * 100)}%</div>
                  </>
                )}
                {analysisResult.frames_analyzed !== undefined && (
                  <>
                    <div>Проанализировано кадров:</div>
                    <div>{analysisResult.frames_analyzed}</div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end mt-6 gap-2">
        <Button variant="outline" onClick={onClose}>
          Закрыть
        </Button>
        {!hasFaceDetectionError() && (
          <Button onClick={onSubmitFeedback} disabled={hasFaceDetectionError()}>
            Отправить оценку
          </Button>
        )}
      </div>
    </div>
  );
};
