
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { History, Video, AlertTriangle, FolderOpen, FileVideo } from 'lucide-react';
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

  // Generate expected video filename based on flight data
  const getExpectedVideoFileName = (flight?: Flight | null) => {
    if (!flight?.flight_id || !flight?.from_code || !flight?.to_code) {
      return null;
    }
    return `flight_${flight.flight_id}_${flight.from_code}_${flight.to_code}.mp4`;
  };

  const expectedFileName = getExpectedVideoFileName(lastFlight);
  const videoExists = lastFlight?.video_path && expectedFileName;

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
          
          {/* Video file information */}
          <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-md space-y-3">
            <div className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-medium">Путь к видео файлу:</span>
            </div>
            <code className="block text-xs text-muted-foreground bg-slate-100 dark:bg-slate-800 p-2 rounded border">
              neural_network/data/video/
            </code>
            
            <div className="flex items-center gap-2">
              <FileVideo className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium">Ожидаемое имя файла:</span>
            </div>
            {expectedFileName ? (
              <div className="space-y-2">
                <code className="block text-xs font-mono bg-slate-100 dark:bg-slate-800 p-2 rounded border">
                  {expectedFileName}
                </code>
                <div className={`flex items-center gap-2 text-xs ${
                  videoExists ? 'text-green-600' : 'text-red-600'
                }`}>
                  <div className={`w-2 h-2 rounded-full ${
                    videoExists ? 'bg-green-500' : 'bg-red-500'
                  }`} />
                  <span>
                    {videoExists ? 'Файл найден' : 'Файл не найден'}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Невозможно определить имя файла (недостаточно данных о рейсе)
              </p>
            )}
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
        disabled={!lastFlight || !videoExists || isAnalyzing}
        className="w-full"
        aria-label="Анализировать последний рейс"
      >
        {isAnalyzing 
          ? 'Анализ видео рейса...' 
          : 'Проанализировать видео рейса'}
      </Button>
      
      {lastFlight && expectedFileName && (
        <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md">
          <p className="text-xs text-blue-700 dark:text-blue-300">
            <strong>Инструкция:</strong> Поместите видео файл с именем{' '}
            <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">
              {expectedFileName}
            </code>{' '}
            в папку{' '}
            <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">
              neural_network/data/video/
            </code>
          </p>
        </div>
      )}
    </div>
  );
};
