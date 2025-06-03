
import { useRef, useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

interface UseMediaRecorderProps {
  maxRecordingTime?: number; // in milliseconds
  onRecordingComplete: (blob: Blob) => void;
}

export const useMediaRecorder = ({ maxRecordingTime = 30000, onRecordingComplete }: UseMediaRecorderProps) => {
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const [recording, setRecording] = useState(false);
  const [cameraError, setCameraError] = useState('');

  // Clean up when unmounting
  useEffect(() => {
    return () => {
      if (mediaRecorder.current?.state === 'recording') {
        mediaRecorder.current.stop();
        mediaRecorder.current.stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

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
          return;
        }
        onRecordingComplete(blob);
        chunks.current = [];
      };

      mediaRecorder.current.start(100);
      setRecording(true);

      // Автоматически прекращаем запись через заданное время
      setTimeout(() => {
        if (mediaRecorder.current?.state === 'recording') {
          stopRecording();
        }
      }, maxRecordingTime);

    } catch (error) {
      setCameraError('Для анализа требуется доступ к камере');
      toast({
        title: "Ошибка доступа к камере",
        description: error instanceof Error ? error.message : "Неизвестная ошибка",
        variant: "destructive"
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorder.current?.state === 'recording') {
      mediaRecorder.current.stop();
      mediaRecorder.current.stream.getTracks().forEach(track => track.stop());
      setRecording(false);
    }
  };

  return {
    videoRef,
    recording,
    cameraError,
    startRecording,
    stopRecording
  };
};
