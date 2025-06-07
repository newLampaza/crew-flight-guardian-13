
import { useState } from 'react';
import { toast } from '@/components/ui/use-toast';
import axios from 'axios';

interface AnalysisResult {
  analysis_id?: number;
  fatigue_level?: string;
  neural_network_score?: number;
  analysis_date?: string;
  feedback_score?: number;
  video_path?: string;
  from_code?: string;
  to_code?: string;
  resolution?: string;
  fps?: number;
  face_detection_ratio?: number;
  frames_analyzed?: number;
  error?: string;
}

interface Flight {
  flight_id?: number;
  from_code?: string;
  to_code?: string;
  departure_time?: string;
  arrival_time?: string;
  video_path?: string;
}

interface HistoryItem {
  analysis_id: number;
  neural_network_score: number;
  analysis_date: string;
  fatigue_level?: string;
  flight_id?: number;
  from_code?: string;
  to_code?: string;
}

const API_BASE_URL = import.meta.env.PROD ? '/api' : 'http://localhost:5000/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('fatigue-guard-token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    console.error('Request error:', error);
    return Promise.reject(error);
  }
);

export const useFatigueAnalysis = (onSuccess?: (result: AnalysisResult) => void) => {
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [analysisProgress, setAnalysisProgress] = useState({
    loading: false,
    message: '',
    percent: 0,
  });
  const [historyData, setHistoryData] = useState<HistoryItem[]>([]);

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const loadHistory = async () => {
    try {
      const response = await apiClient.get('/fatigue/history');
      if (response.data) {
        const formattedHistory = response.data.map((item: any) => ({
          analysis_id: item.analysis_id,
          neural_network_score: item.neural_network_score || 0,
          analysis_date: item.analysis_date,
          fatigue_level: item.fatigue_level,
          flight_id: item.flight_id,
          from_code: item.from_code,
          to_code: item.to_code
        }));
        console.log('Loaded history data:', formattedHistory);
        setHistoryData(formattedHistory);
      }
    } catch (error) {
      console.error('Failed to load history:', error);
      setHistoryData([]);
    }
  };

  const submitFeedback = async (analysisId: number, score: number) => {
    try {
      // Use the correct fatigue feedback endpoint
      await apiClient.post('/fatigue/feedback', {
        analysis_id: analysisId,
        score: score
      });
      
      toast({
        title: "Отзыв сохранен",
        description: `Спасибо за вашу оценку: ${score} из 5`
      });
      
      return true;
    } catch (error) {
      console.error('Failed to submit feedback:', error);
      toast({
        title: "Ошибка отправки отзыва",
        description: "Не удалось сохранить отзыв",
        variant: "destructive"
      });
      return false;
    }
  };

  const submitRecording = async (blob: Blob) => {
    try {
      setRecordedBlob(blob);
      setAnalysisProgress({
        loading: true,
        message: 'Обработка видео...',
        percent: 20,
      });

      if (!blob || blob.size === 0) {
        throw new Error('Записанное видео слишком короткое или повреждено');
      }

      const formData = new FormData();
      formData.append('video', blob, `recording_${Date.now()}.webm`);

      setAnalysisProgress({
        loading: true,
        message: 'Анализ нейросетью...',
        percent: 60,
      });

      const response = await apiClient.post('/fatigue/analyze', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / (progressEvent.total || 100));
          setAnalysisProgress(p => ({
            ...p,
            percent: 40 + Math.min(percentCompleted / 2, 40),
          }));
        }
      });

      setAnalysisProgress({
        loading: false,
        message: '',
        percent: 100,
      });

      if (response.data) {
        setAnalysisResult(response.data);
        if (onSuccess) onSuccess(response.data);
        await loadHistory();
      }
      
    } catch (error: any) {
      setAnalysisProgress({loading: false, message: '', percent: 0});
      
      if (error.response?.status === 401) {
        toast({
          title: "Ошибка авторизации",
          description: "Необходимо выполнить вход в систему",
          variant: "destructive"
        });
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
        return;
      }
      
      if (error.response?.status === 400 && error.response?.data?.error?.includes('face')) {
        const faceErrorResult = {
          analysis_id: Math.floor(Math.random() * 1000) + 1,
          fatigue_level: 'Unknown',
          neural_network_score: 0,
          analysis_date: new Date().toISOString(),
          face_detection_ratio: 0,
          error: error.response.data.error
        };
        setAnalysisResult(faceErrorResult);
        if (onSuccess) onSuccess(faceErrorResult);
        return;
      }
      
      toast({
        title: "Ошибка анализа",
        description: error.message || "Неизвестная ошибка",
        variant: "destructive"
      });
    }
  };

  const analyzeFlight = async (flight?: Flight | null) => {
    console.log('[useFatigueAnalysis] analyzeFlight called with:', flight);
    
    try {
      setAnalysisProgress({
        loading: true,
        message: 'Анализ видео рейса...',
        percent: 40,
      });

      // Use video_path from flight data, or generate expected filename
      let videoPath = flight?.video_path;
      
      if (!videoPath && flight?.flight_id && flight?.from_code && flight?.to_code) {
        videoPath = `flight_${flight.flight_id}_${flight.from_code}_${flight.to_code}.mp4`;
        console.log('[useFatigueAnalysis] Generated video path:', videoPath);
      }
      
      console.log('[useFatigueAnalysis] Video path for analysis:', videoPath);
      
      if (!videoPath) {
        console.error('[useFatigueAnalysis] No video path available for flight');
        throw new Error('Video path not available for this flight');
      }

      const requestData = {
        flight_id: flight?.flight_id,
        video_path: videoPath
      };
      
      console.log('[useFatigueAnalysis] Sending analyze-flight request:', requestData);

      const response = await apiClient.post('/fatigue/analyze-flight', requestData);

      console.log('[useFatigueAnalysis] Analyze-flight response:', response.data);

      setAnalysisProgress({loading: false, message: '', percent: 100});

      if (response.data) {
        setAnalysisResult(response.data);
        if (onSuccess) onSuccess(response.data);
        await loadHistory();
      }
      
    } catch (error: any) {
      console.error('[useFatigueAnalysis] Flight analysis error:', error);
      setAnalysisProgress({loading: false, message: '', percent: 0});
      
      if (error.response?.status === 404) {
        const expectedFile = flight?.video_path || `flight_${flight?.flight_id}_${flight?.from_code}_${flight?.to_code}.mp4`;
        console.error('[useFatigueAnalysis] Video file not found:', expectedFile);
        toast({
          title: "Видео не найдено",
          description: `Видео рейса не найдено. Убедитесь, что файл ${expectedFile} существует в папке neural_network/data/video/`,
          variant: "destructive"
        });
      } else {
        console.error('[useFatigueAnalysis] Other error:', error.response?.data || error.message);
        toast({
          title: "Ошибка анализа рейса",
          description: error.message || "Неизвестная ошибка",
          variant: "destructive"
        });
      }
    }
  };

  return {
    analysisResult,
    setAnalysisResult,
    recordedBlob,
    analysisProgress,
    historyData,
    submitRecording,
    analyzeFlight,
    submitFeedback,
    loadHistory,
    formatDate
  };
};
