
import React, { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { StarRating } from './StarRating';
import { cn } from '@/lib/utils';
import { FileVideo, Video } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

interface AnalysisResultProps {
  analysisResult: {
    analysis_id?: number;
    fatigue_level?: string;
    neural_network_score?: number;
    analysis_date?: string;
    video_path?: string;
    from_code?: string;
    to_code?: string;
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

  const getFatigueLevel = (level?: string) => {
    switch (level?.toLowerCase()) {
      case 'high': return 'Высокий';
      case 'medium': return 'Средний';
      case 'low': return 'Низкий';
      default: return 'Нет данных';
    }
  };
  
  const getFatigueLevelClass = (level?: string) => {
    switch (level?.toLowerCase()) {
      case 'high': return 'text-rose-500';
      case 'medium': return 'text-amber-500';
      default: return 'text-emerald-500';
    }
  };

  // Функция для форматирования URL видео для корректного отображения
  const formatVideoUrl = (path?: string) => {
    if (!path) return '';
    
    // Заменяем обратные слэши на прямые
    const normalizedPath = path.replace(/\\/g, '/');
    
    // Проверяем, является ли путь абсолютным URL
    if (normalizedPath.startsWith('http')) {
      return normalizedPath;
    }
    
    // Формируем полный URL к API эндпоинту
    const apiBase = import.meta.env.PROD ? '/api' : 'http://localhost:5000/api';
    
    // Проверяем начинается ли путь с videos/
    if (normalizedPath.startsWith('videos/')) {
      return `${apiBase}/${normalizedPath}`;
    }
    
    // Проверяем начинается ли путь с neural_network/
    if (normalizedPath.startsWith('neural_network/')) {
      return `${apiBase}/${normalizedPath.substring('neural_network/'.length)}`;
    }
    
    return `${apiBase}/videos/${normalizedPath}`;
  };

  useEffect(() => {
    if (analysisResult?.video_path) {
      // Show notification about video location
      toast({
        title: "Видео сохранено",
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

  return (
    <div className="space-y-4">
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
                (analysisResult.neural_network_score || 0) > 0.7 ? 'text-rose-500' : 
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

      <div className="flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-900 rounded-lg">
        <span className="text-muted-foreground">Оценка системы:</span>
        <StarRating currentRating={feedbackScore} onRatingChange={setFeedbackScore} />
      </div>

      {analysisResult.video_path && (
        <div className="mt-4 space-y-2">
          <div className="flex items-center gap-2 mb-2">
            <Video className="h-5 w-5 text-primary" />
            <h4 className="text-sm font-medium">Запись с анализом нейросети:</h4>
          </div>
          
          <div className="relative">
            <video 
              ref={videoRef}
              controls 
              src={formatVideoUrl(analysisResult.video_path)}
              className="w-full rounded-md bg-black aspect-video"
              onError={(e) => {
                console.error("Ошибка загрузки видео:", e);
                toast({
                  title: "Ошибка загрузки видео",
                  description: "Не удалось загрузить видеозапись. Проверьте путь и формат файла.",
                  variant: "destructive"
                });
              }}
            />
            <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
              <FileVideo className="h-3 w-3" />
              <span>Анализ нейросети</span>
            </div>
          </div>
          
          <div className="bg-muted/20 p-3 rounded-md border border-dashed text-xs text-muted-foreground">
            <strong className="block mb-1">Расположение видео:</strong>
            <code className="break-all">{analysisResult.video_path}</code>
          </div>
        </div>
      )}

      <div className="flex justify-end mt-6 gap-2">
        <Button variant="outline" onClick={onClose}>
          Закрыть
        </Button>
        <Button onClick={onSubmitFeedback}>
          Отправить оценку
        </Button>
      </div>
    </div>
  );
};
