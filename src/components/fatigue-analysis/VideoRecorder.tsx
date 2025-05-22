
import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Video, Save, Download } from 'lucide-react';

interface VideoRecorderProps {
  recording: boolean;
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
  onStartRecording,
  onStopRecording,
  analysisResult,
  cameraError,
  videoRef,
  recordedBlob,
  saveToHistory
}) => {
  // Function to download recorded video
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

  // Function to save the recorded video to database
  const handleSaveToHistory = () => {
    if (recordedBlob && saveToHistory) {
      saveToHistory(recordedBlob);
    }
  };

  const recorderDescription = "Запись и анализ видео для определения уровня усталости пилота";

  return (
    <div 
      className="p-6 border rounded-lg transition-all duration-200 border-primary bg-primary/5"
      aria-describedby="video-recorder-description"
    >
      <div className="flex items-center gap-3 mb-4">
        <Video className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-medium">Реальный анализ</h3>
      </div>
      
      <p id="video-recorder-description" className="text-sm text-muted-foreground mb-4">
        {recorderDescription}
      </p>
      
      {recording ? (
        <Button variant="destructive" onClick={onStopRecording} className="w-full mb-4">
          Остановить запись
          {recording && <span className="ml-2 inline-block animate-pulse text-white">●</span>}
        </Button>
      ) : (
        <Button onClick={onStartRecording} className="w-full mb-4">
          {analysisResult ? 'Повторить запись' : 'Начать запись (30 сек)'}
        </Button>
      )}
      
      {/* Larger camera display with smooth transition */}
      <div 
        className={`mt-4 transition-all duration-500 ease-in-out transform ${
          recording ? 'opacity-100 scale-100 max-h-[50vh]' : 'opacity-0 scale-95 max-h-0 overflow-hidden'
        }`}
      >
        <video 
          ref={videoRef} 
          autoPlay 
          muted 
          playsInline 
          className="w-full rounded-md bg-black aspect-video shadow-lg"
          aria-label="Видео с камеры для анализа усталости"
        />
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
        <div className="mt-3 p-3 bg-destructive/10 text-destructive rounded-md text-sm">
          {cameraError}
        </div>
      )}
    </div>
  );
};
