
import React, { useRef, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Camera, Square, Play, RotateCcw, Save } from 'lucide-react';
import { useMediaRecorder } from '@/hooks/useMediaRecorder';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface VideoRecorderProps {
  onAnalyze: (blob: Blob) => void;
  onSaveToHistory: (blob: Blob) => void;
  analysisProgress?: {
    loading: boolean;
    message: string;
    percent: number;
  };
}

export const VideoRecorder: React.FC<VideoRecorderProps> = ({ 
  onAnalyze, 
  onSaveToHistory,
  analysisProgress 
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [hasRecording, setHasRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);

  const {
    stream,
    startRecording,
    stopRecording,
    recordedChunks
  } = useMediaRecorder({
    onDataAvailable: (blob) => {
      console.log('Recording completed, blob size:', blob.size);
      setRecordedBlob(blob);
      setHasRecording(true);
      
      if (videoRef.current) {
        videoRef.current.srcObject = null;
        videoRef.current.src = URL.createObjectURL(blob);
      }
    }
  });

  // Timer for recording duration
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  // Setup video stream
  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const handleStartRecording = async () => {
    try {
      setRecordingTime(0);
      setHasRecording(false);
      setRecordedBlob(null);
      await startRecording();
      setIsRecording(true);
    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  };

  const handleStopRecording = () => {
    stopRecording();
    setIsRecording(false);
  };

  const handleRetakeRecording = () => {
    setHasRecording(false);
    setRecordedBlob(null);
    setRecordingTime(0);
    if (videoRef.current) {
      videoRef.current.src = '';
      videoRef.current.srcObject = stream;
    }
  };

  const handleAnalyze = () => {
    if (recordedBlob) {
      onAnalyze(recordedBlob);
    }
  };

  // Убираем кнопку "Сохранить запись" - теперь это происходит автоматически при отправке отзыва
  // const handleSaveToHistory = () => {
  //   if (recordedBlob) {
  //     onSaveToHistory(recordedBlob);
  //   }
  // };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Camera className="h-5 w-5" />
          Запись видео для анализа усталости
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover"
          />
          
          {isRecording && (
            <div className="absolute top-4 left-4 bg-red-500 text-white px-3 py-1 rounded-full flex items-center gap-2">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
              REC {formatTime(recordingTime)}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2 justify-center">
          {!isRecording && !hasRecording && (
            <Button onClick={handleStartRecording} className="flex items-center gap-2">
              <Camera className="h-4 w-4" />
              Начать запись
            </Button>
          )}

          {isRecording && (
            <Button onClick={handleStopRecording} variant="destructive" className="flex items-center gap-2">
              <Square className="h-4 w-4" />
              Остановить запись
            </Button>
          )}

          {hasRecording && !analysisProgress?.loading && (
            <>
              <Button onClick={handleRetakeRecording} variant="outline" className="flex items-center gap-2">
                <RotateCcw className="h-4 w-4" />
                Перезаписать
              </Button>
              
              <Button onClick={handleAnalyze} className="flex items-center gap-2">
                <Play className="h-4 w-4" />
                Анализировать
              </Button>
            </>
          )}
        </div>

        {hasRecording && (
          <Alert>
            <AlertDescription>
              Запись готова для анализа. Запись будет автоматически сохранена при отправке отзыва о полете.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};
