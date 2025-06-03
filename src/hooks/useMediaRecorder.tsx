
import { useRef, useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

interface UseMediaRecorderProps {
  maxRecordingTime?: number;
  onRecordingComplete: (blob: Blob) => void;
}

export const useMediaRecorder = ({ maxRecordingTime = 30000, onRecordingComplete }: UseMediaRecorderProps) => {
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const [recording, setRecording] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [timeLeft, setTimeLeft] = useState(0);

  // Clean up function
  const cleanup = useCallback(() => {
    if (mediaRecorder.current?.state === 'recording') {
      mediaRecorder.current.stop();
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    chunks.current = [];
    setRecording(false);
    setTimeLeft(0);
    setCameraError('');
  }, []);

  // Clean up when unmounting
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  const startRecording = async () => {
    try {
      setCameraError('');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
          facingMode: 'user'
        }
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      const options = { 
        mimeType: 'video/webm; codecs=vp9',
        videoBitsPerSecond: 2500000
      };

      mediaRecorder.current = new MediaRecorder(stream, options);
      
      mediaRecorder.current.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.current.push(e.data);
        }
      };

      mediaRecorder.current.onstop = () => {
        const blob = new Blob(chunks.current, { type: 'video/webm' });
        if (blob.size === 0) {
          toast({
            title: "Ошибка записи",
            description: "Записанное видео пустое или повреждено",
            variant: "destructive"
          });
          cleanup();
          return;
        }
        onRecordingComplete(blob);
        cleanup();
      };

      mediaRecorder.current.start(100);
      setRecording(true);
      setTimeLeft(maxRecordingTime / 1000);

      // Timer countdown
      const timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      // Auto-stop recording
      setTimeout(() => {
        if (mediaRecorder.current?.state === 'recording') {
          stopRecording();
        }
        clearInterval(timer);
      }, maxRecordingTime);

    } catch (error) {
      setCameraError('Для анализа требуется доступ к камере');
      toast({
        title: "Ошибка доступа к камере",
        description: error instanceof Error ? error.message : "Неизвестная ошибка",
        variant: "destructive"
      });
      cleanup();
    }
  };

  const stopRecording = useCallback(() => {
    if (mediaRecorder.current?.state === 'recording') {
      mediaRecorder.current.stop();
    }
  }, []);

  return {
    videoRef,
    recording,
    cameraError,
    timeLeft,
    startRecording,
    stopRecording,
    cleanup
  };
};
