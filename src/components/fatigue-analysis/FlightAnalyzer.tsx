
import React from 'react';
import { Button } from '@/components/ui/button';
import { History, Video } from 'lucide-react';

interface Flight {
  flight_id?: number;
  from_code?: string;
  to_code?: string;
  departure_time?: string;
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
  return (
    <div className="p-6 border rounded-lg transition-all duration-200 border-border">
      <div className="flex items-center gap-3 mb-4">
        <History className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-medium">Анализ последнего рейса</h3>
      </div>
      
      {lastFlight && (
        <div className="mb-4">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">{lastFlight.from_code || 'N/A'} → {lastFlight.to_code || 'N/A'}</span>
            {lastFlight.video_path && (
              <div className="flex items-center gap-1 text-green-500 text-xs bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded">
                <Video className="h-3 w-3" />
                <span>Запись</span>
              </div>
            )}
          </div>
          <p className="text-sm text-muted-foreground">({formatDate(lastFlight.departure_time)})</p>
        </div>
      )}
      
      <Button 
        onClick={onAnalyzeFlight}
        disabled={!lastFlight}
        className="w-full"
        aria-label="Анализировать последний рейс"
      >
        {lastFlight?.video_path ? 'Проанализировать запись' : 'Анализировать рейс'}
      </Button>
      
      {!lastFlight && (
        <p className="mt-3 text-sm text-muted-foreground">
          Нет доступных рейсов для анализа
        </p>
      )}
    </div>
  );
};
