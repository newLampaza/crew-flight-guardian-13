
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
  
  // Добавляем детальные логи для отладки
  console.log('[FlightAnalyzer] lastFlight data:', lastFlight);
  console.log('[FlightAnalyzer] video_path from lastFlight:', lastFlight?.video_path);
  
  const handleAnalyzeClick = async () => {
    console.log('[FlightAnalyzer] Starting flight analysis with flight:', lastFlight);
    try {
      setIsAnalyzing(true);
      await onAnalyzeFlight();
    } catch (error) {
      console.error('[FlightAnalyzer] Failed to analyze flight:', error);
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
      console.log('[FlightAnalyzer] Cannot generate filename - missing flight data:', {
        flight_id: flight?.flight_id,
        from_code: flight?.from_code,
        to_code: flight?.to_code
      });
      return null;
    }
    const filename = `flight_${flight.flight_id}_${flight.from_code}_${flight.to_code}.mp4`;
    console.log('[FlightAnalyzer] Generated expected filename:', filename);
    return filename;
  };

  const expectedFileName = getExpectedVideoFileName(lastFlight);
  
  // Проверяем наличие video_path в данных рейса
  const hasVideoPath = Boolean(lastFlight?.video_path);
  const videoExists = hasVideoPath && expectedFileName;
  
  console.log('[FlightAnalyzer] Video status check:', {
    hasVideoPath,
    video_path: lastFlight?.video_path,
    expectedFileName,
    videoExists
  });

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
          
          {/* Отладочная информация */}
          <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-md border border-yellow-200 dark:border-yellow-800">
            <p className="text-xs font-medium text-yellow-800 dark:text-yellow-200 mb-2">🔍 Отладочная информация:</p>
            <div className="space-y-1 text-xs text-yellow-700 dark:text-yellow-300">
              <div>Flight ID: <code>{lastFlight.flight_id || 'отсутствует'}</code></div>
              <div>Video path из БД: <code>{lastFlight.video_path || 'null/отсутствует'}</code></div>
              <div>Ожидаемое имя файла: <code>{expectedFileName || 'не может быть создано'}</code></div>
              <div>Статус файла: <span className={hasVideoPath ? 'text-green-600' : 'text-red-600'}>
                {hasVideoPath ? '✓ Путь есть в БД' : '✗ Путь отсутствует в БД'}
              </span></div>
            </div>
          </div>
          
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
              <span className="text-sm font-medium">Информация о файле:</span>
            </div>
            
            {lastFlight.video_path ? (
              <div className="space-y-2">
                <div className="text-sm">
                  <strong>Файл из БД:</strong>
                  <code className="block text-xs font-mono bg-slate-100 dark:bg-slate-800 p-2 rounded border mt-1">
                    {lastFlight.video_path}
                  </code>
                </div>
                {expectedFileName && (
                  <div className="text-sm">
                    <strong>Ожидаемый файл:</strong>
                    <code className="block text-xs font-mono bg-slate-100 dark:bg-slate-800 p-2 rounded border mt-1">
                      {expectedFileName}
                    </code>
                  </div>
                )}
                <div className={`flex items-center gap-2 text-xs ${
                  lastFlight.video_path === expectedFileName ? 'text-green-600' : 'text-orange-600'
                }`}>
                  <div className={`w-2 h-2 rounded-full ${
                    lastFlight.video_path === expectedFileName ? 'bg-green-500' : 'bg-orange-500'
                  }`} />
                  <span>
                    {lastFlight.video_path === expectedFileName 
                      ? '✓ Имена файлов совпадают' 
                      : '⚠ Имена файлов не совпадают'}
                  </span>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-red-600">
                  ✗ В БД не указан путь к видео файлу (video_path = null)
                </p>
                {expectedFileName && (
                  <div className="text-sm">
                    <strong>Должен быть файл:</strong>
                    <code className="block text-xs font-mono bg-slate-100 dark:bg-slate-800 p-2 rounded border mt-1">
                      {expectedFileName}
                    </code>
                  </div>
                )}
              </div>
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
        disabled={!lastFlight || !hasVideoPath || isAnalyzing}
        className="w-full"
        aria-label="Анализировать последний рейс"
      >
        {isAnalyzing 
          ? 'Анализ видео рейса...' 
          : 'Проанализировать видео рейса'}
      </Button>
      
      {!hasVideoPath && lastFlight && (
        <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-md border border-red-200 dark:border-red-800">
          <p className="text-xs text-red-700 dark:text-red-300">
            <strong>Проблема:</strong> В базе данных не указан путь к видео файлу для этого рейса. 
            Необходимо обновить поле video_path в таблице Flights.
          </p>
        </div>
      )}
      
      {hasVideoPath && lastFlight && expectedFileName && (
        <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md">
          <p className="text-xs text-blue-700 dark:text-blue-300">
            <strong>Инструкция:</strong> Убедитесь, что видео файл{' '}
            <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">
              {lastFlight.video_path}
            </code>{' '}
            находится в папке{' '}
            <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">
              neural_network/data/video/
            </code>
          </p>
        </div>
      )}
    </div>
  );
};
