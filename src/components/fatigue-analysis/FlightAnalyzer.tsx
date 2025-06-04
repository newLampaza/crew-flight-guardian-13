
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { History, Video, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Flight {
  flight_id?: number;
  from_code?: string;
  to_code?: string;
  departure_time?: string;
  arrival_time?: string;
  video_path?: string;
}

interface FlightAnalyzerProps {
  lastFlight: Flight | null;
  onAnalyzeFlight: () => void;
  formatDate: (dateString?: string) => string;
}

export const FlightAnalyzer: React.FC<FlightAnalyzerProps> = ({
  lastFlight,
  onAnalyzeFlight,
  formatDate
}) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const { toast } = useToast();
  
  const handleAnalyzeClick = async () => {
    try {
      setIsAnalyzing(true);
      await onAnalyzeFlight();
    } catch (error) {
      console.error('Failed to analyze flight:', error);
      toast({
        title: 'Ошибка анализа',
        description: 'Не удалось проанализировать запись полета',
        variant: 'destructive'
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Генерируем ожидаемое имя файла
  const expectedVideoFile = lastFlight 
    ? `flight_${lastFlight.flight_id}_${lastFlight.from_code}_${lastFlight.to_code}.mp4`
    : 'default_flight_video.mp4';

  return (
    <div className="p-6 border rounded-lg transition-all duration-200 border-border">
      <div className="flex items-center gap-3 mb-4">
        <History className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-medium">Анализ последнего рейса</h3>
      </div>
      
      {lastFlight ? (
        <div className="mb-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">
              {lastFlight.from_code || 'N/A'} → {lastFlight.to_code || 'N/A'}
            </span>
            <div className="flex items-center gap-1 text-blue-500 text-xs bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded">
              <Video className="h-3 w-3" />
              <span>Рейс #{lastFlight.flight_id}</span>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Отправление: {formatDate(lastFlight.departure_time)}
          </p>
          {lastFlight.arrival_time && (
            <p className="text-sm text-muted-foreground">
              Прибытие: {formatDate(lastFlight.arrival_time)}
            </p>
          )}
          
          <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-md">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-medium">Ожидаемый файл видео:</span>
            </div>
            <code className="text-xs text-muted-foreground break-all">
              neural_network/data/video/{expectedVideoFile}
            </code>
          </div>
        </div>
      ) : (
        <div className="mb-4 p-3 bg-slate-50 dark:bg-slate-900 rounded-md">
          <p className="text-sm text-muted-foreground">
            Нет доступных рейсов для анализа
          </p>
        </div>
      )}
      
      <Button 
        onClick={handleAnalyzeClick}
        disabled={!lastFlight || isAnalyzing}
        className="w-full"
        aria-label="Анализировать последний рейс"
      >
        {isAnalyzing 
          ? 'Анализ видео рейса...' 
          : 'Проанализировать видео рейса'}
      </Button>
      
      {lastFlight && (
        <p className="mt-3 text-xs text-muted-foreground">
          Убедитесь, что видео файл <strong>{expectedVideoFile}</strong> находится в папке neural_network/data/video/
        </p>
      )}
    </div>
  );
};
