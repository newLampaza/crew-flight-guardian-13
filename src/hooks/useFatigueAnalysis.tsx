
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
  video_path?: string;
}

const API_BASE_URL = import.meta.env.PROD ? '/api' : 'http://localhost:5000/api';

// Configure axios instance with proper base URL and auth token
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000, // 60 секунд для анализа видео
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add authentication token to each request
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('fatigue-guard-token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    } else {
      console.warn('No authentication token available for API request');
    }
    return config;
  },
  (error) => {
    console.error('Request error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor для обработки ошибок авторизации
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      console.error('Unauthorized access - redirecting to login');
      // Можно добавить редирект на страницу логина
      // window.location.href = '/login';
    }
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

  const submitRecording = async (blob: Blob) => {
    try {
      setRecordedBlob(blob);
      setAnalysisProgress({
        loading: true,
        message: 'Подготовка видео...',
        percent: 10,
      });

      if (!blob || blob.size === 0) {
        throw new Error('Записанное видео слишком короткое или повреждено');
      }

      // Проверяем размер файла (ограничение Flask обычно 16MB)
      const maxSize = 16 * 1024 * 1024; // 16MB
      if (blob.size > maxSize) {
        throw new Error('Файл слишком большой. Максимальный размер: 16MB');
      }

      const formData = new FormData();
      formData.append('video', blob, `recording_${Date.now()}.webm`);

      setAnalysisProgress({
        loading: true,
        message: 'Загрузка на сервер...',
        percent: 30,
      });

      console.log('Submitting video to API:', `${API_BASE_URL}/fatigue/analyze`);
      console.log('Video blob size:', blob.size, 'bytes');
      
      try {
        // Реальный запрос к Flask API
        const response = await apiClient.post('/fatigue/analyze', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          onUploadProgress: (progressEvent) => {
            const total = progressEvent.total || blob.size;
            const percentCompleted = Math.round((progressEvent.loaded * 100) / total);
            setAnalysisProgress(p => ({
              ...p,
              percent: 30 + Math.min(percentCompleted / 2, 40), // от 30% до 70%
              message: percentCompleted < 100 ? 'Загрузка на сервер...' : 'Анализ нейросетью...'
            }));
          }
        });

        setAnalysisProgress({
          loading: false,
          message: '',
          percent: 100,
        });

        if (response.data) {
          console.log('API Response:', response.data);
          setAnalysisResult(response.data);
          if (onSuccess) onSuccess(response.data);
          
          toast({
            title: "Анализ завершен",
            description: `Уровень усталости: ${response.data.fatigue_level || 'не определен'}`,
            variant: "default"
          });
        }
      } catch (apiError: any) {
        console.error('API Error:', apiError);
        setAnalysisProgress({loading: false, message: '', percent: 0});
        
        if (apiError.response?.status === 401) {
          toast({
            title: "Ошибка авторизации",
            description: "Необходимо выполнить вход в систему",
            variant: "destructive"
          });
          return;
        }
        
        // Обработка специфических ошибок API
        if (apiError.response?.status === 400) {
          const errorMessage = apiError.response?.data?.error || apiError.message;
          if (errorMessage.toLowerCase().includes('face')) {
            toast({
              title: "Лицо не обнаружено",
              description: "Попробуйте записать видео с лучшим освещением, расположив лицо по центру кадра",
              variant: "destructive"
            });
            return;
          }
        }
        
        if (apiError.response?.status === 413) {
          toast({
            title: "Файл слишком большой",
            description: "Попробуйте записать более короткое видео",
            variant: "destructive"
          });
          return;
        }
        
        toast({
          title: "Ошибка анализа",
          description: `${apiError.message}. Проверьте подключение к серверу.`,
          variant: "destructive"
        });
      }
      
    } catch (error) {
      setAnalysisProgress({loading: false, message: '', percent: 0});
      console.error('Analysis error:', error);
      toast({
        title: "Ошибка анализа",
        description: error instanceof Error ? error.message : "Неизвестная ошибка",
        variant: "destructive"
      });
    }
  };

  const saveToHistory = async (blob: Blob) => {
    try {
      setAnalysisProgress({
        loading: true,
        message: 'Сохранение записи...',
        percent: 50,
      });

      const formData = new FormData();
      formData.append('video', blob, `history_${Date.now()}.webm`);
      
      try {
        console.log('Saving video to API:', `${API_BASE_URL}/fatigue/save-recording`);
        
        const response = await apiClient.post('/fatigue/save-recording', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          }
        });
        
        setAnalysisProgress({loading: false, message: '', percent: 0});
        
        toast({
          title: "Запись сохранена",
          description: "Видео успешно сохранено в базе данных"
        });
        return response.data;
      } catch (apiError: any) {
        console.error('Save API Error:', apiError);
        setAnalysisProgress({loading: false, message: '', percent: 0});
        
        if (apiError.response?.status === 401) {
          toast({
            title: "Ошибка авторизации",
            description: "Необходимо выполнить вход в систему",
            variant: "destructive"
          });
          return null;
        }
        
        toast({
          title: "Ошибка сохранения",
          description: `Не удалось сохранить запись: ${apiError.message}`,
          variant: "destructive"
        });
        return null;
      }
      
    } catch (error) {
      setAnalysisProgress({loading: false, message: '', percent: 0});
      toast({
        title: "Ошибка сохранения",
        description: error instanceof Error ? error.message : "Неизвестная ошибка",
        variant: "destructive"
      });
      return null;
    }
  };

  const analyzeFlight = async (lastFlight?: Flight | null) => {
    try {
      setAnalysisProgress({
        loading: true,
        message: 'Подготовка к анализу рейса...',
        percent: 20,
      });

      try {
        console.log('Analyzing flight with API:', `${API_BASE_URL}/fatigue/analyze-flight`, lastFlight);
        
        const response = await apiClient.post('/fatigue/analyze-flight', {
          flight_id: lastFlight?.flight_id,
        });

        setAnalysisProgress({loading: false, message: '', percent: 100});

        console.log('Flight analysis response:', response.data);
        
        if (response.data) {
          setAnalysisResult(response.data);
          if (onSuccess) onSuccess(response.data);
          
          toast({
            title: "Анализ рейса завершен",
            description: `Рейс ${lastFlight?.from_code} → ${lastFlight?.to_code}`,
            variant: "default"
          });
        }
      } catch (apiError: any) {
        console.error('Flight analysis API Error:', apiError);
        setAnalysisProgress({loading: false, message: '', percent: 0});
        
        if (apiError.response?.status === 401) {
          toast({
            title: "Ошибка авторизации",
            description: "Необходимо выполнить вход в систему",
            variant: "destructive"
          });
          return;
        }
        
        if (apiError.response?.status === 404) {
          toast({
            title: "Рейс не найден",
            description: "Данные о рейсе недоступны или отсутствуют",
            variant: "destructive"
          });
          return;
        }
        
        toast({
          title: "Ошибка анализа рейса",
          description: `${apiError.message}. Проверьте подключение к серверу.`,
          variant: "destructive"
        });
      }

    } catch (error) {
      setAnalysisProgress({loading: false, message: '', percent: 0});
      toast({
        title: "Ошибка анализа рейса",
        description: error instanceof Error ? error.message : "Неизвестная ошибка",
        variant: "destructive"
      });
    }
  };

  return {
    analysisResult,
    setAnalysisResult,
    recordedBlob,
    analysisProgress,
    submitRecording,
    analyzeFlight,
    saveToHistory,
    formatDate
  };
};
