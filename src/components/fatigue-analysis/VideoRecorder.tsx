
import React from 'react';
import { Button } from '@/components/ui/button';
import { Video, Save, Download, Lightbulb, Eye, AlertCircle, Timer } from 'lucide-react';

interface VideoRecorderProps {
  recording: boolean;
  timeLeft?: number;
  onStartRecording: () => void;
  onStopRecording: () => void;
  analysisResult: any;
  cameraError: string;
  videoRef: React.RefObject<HTMLVideoElement>;
  recordedBlob?: Blob;
  saveToHistory?: (blob: Blob) => void;
}

export const VideoRecorder: React.FC<VideoRecorderProps> = ({
  recording,
  timeLeft = 0,
  onStartRecording,
  onStopRecording,
  analysisResult,
  cameraError,
  videoRef,
  recordedBlob,
  saveToHistory
}) => {
  const handleDownloadVideo = () => {
    if (!recordedBlob) return;
    
    const url = URL.createObjectURL(recordedBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fatigue-recording-${new Date().getTime()}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSaveToHistory = () => {
    if (recordedBlob && saveToHistory) {
      saveToHistory(recordedBlob);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="p-6 border rounded-lg transition-all duration-200 border-primary bg-primary/5">
      <div className="flex items-center gap-3 mb-4">
        <Video className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-medium">Реальный анализ</h3>
        {recording && timeLeft > 0 && (
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Timer className="h-4 w-4" />
            <span>{formatTime(timeLeft)}</span>
          </div>
        )}
      </div>
      
      <p className="text-sm text-muted-foreground mb-4">
        Запись и анализ видео для определения уровня усталости пилота
      </p>

      {/* Recording Tips */}
      <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-md border border-blue-200 dark:border-blue-800">
        <div className="flex items-start gap-2">
          <Lightbulb className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-800 dark:text-blue-200">
            <p className="font-medium mb-1">Советы для успешной записи:</p>
            <ul className="space-y-1 text-xs">
              <li className="flex items-center gap-1">
                <Eye className="h-3 w-3" />
                Расположите лицо по центру кадра
              </li>
              <li>• Обеспечьте хорошее освещение</li>
              <li>• Смотрите прямо в камеру</li>
              <li>• Не закрывайте лицо руками</li>
            </ul>
          </div>
        </div>
      </div>
      
      {recording ? (
        <Button variant="destructive" onClick={onStopRecording} className="w-full mb-4">
          Остановить запись
          <span className="ml-2 inline-block animate-pulse text-white">●</span>
        </Button>
      ) : (
        <Button onClick={onStartRecording} className="w-full mb-4">
          {analysisResult ? 'Повторить запись' : 'Начать запись (30 сек)'}
        </Button>
      )}
      
      {/* Camera display */}
      <div className={`mt-4 transition-all duration-500 ease-in-out transform ${
          recording ? 'opacity-100 scale-100 max-h-[50vh]' : 'opacity-0 scale-95 max-h-0 overflow-hidden'
        }`}>
        <div className="relative">
          <video 
            ref={videoRef} 
            autoPlay 
            muted 
            playsInline 
            className="w-full rounded-md bg-black aspect-video shadow-lg"
            aria-label="Видео с камеры для анализа усталости"
          />
          
          {recording && (
            <div className="absolute top-2 right-2 bg-red-500 text-white px-2 py-1 rounded text-xs font-medium flex items-center gap-1">
              <span className="animate-pulse">●</span>
              REC
            </div>
          )}
        </div>
      </div>
      
      {recordedBlob && !recording && (
        <div className="mt-4 flex gap-2">
          <Button variant="outline" size="sm" onClick={handleSaveToHistory} className="flex-1">
            <Save className="mr-2 h-4 w-4" />
            Сохранить запись
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownloadVideo} className="flex-1">
            <Download className="mr-2 h-4 w-4" />
            Скачать запись
          </Button>
        </div>
      )}
      
      {cameraError && (
        <div className="mt-3 p-3 bg-destructive/10 text-destructive rounded-md text-sm flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium">Ошибка доступа к камере</p>
            <p className="text-xs mt-1">{cameraError}</p>
          </div>
        </div>
      )}
    </div>
  );
};
