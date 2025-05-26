
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
}

interface Flight {
  flight_id?: number;
  from_code?: string;
  to_code?: string;
  departure_time?: string;
  video_path?: string;
}

const API_BASE_URL = import.meta.env.PROD ? '/api' : 'http://localhost:5000/api';

// Логгер с разными уровнями
const logger = {
  info: (message: string, data?: any) => {
    console.log(`[FatigueAnalysis] INFO: ${message}`, data || '');
  },
  warn: (message: string, data?: any) => {
    console.warn(`[FatigueAnalysis] WARN: ${message}`, data || '');
  },
  error: (message: string, error?: any) => {
    console.error(`[FatigueAnalysis] ERROR: ${message}`, error || '');
  },
  debug: (message: string, data?: any) => {
    console.debug(`[FatigueAnalysis] DEBUG: ${message}`, data || '');
  }
};

// Configure axios instance with proper base URL and auth token
const apiClient = axios.create({
  baseURL: API_BASE_URL,
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
      logger.debug('Добавлен токен авторизации к запросу');
    } else {
      logger.warn('Токен авторизации отсутствует');
    }
    
    logger.info(`Отправка запроса: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    logger.error('Ошибка при подготовке запроса', error);
    return Promise.reject(error);
  }
);

// Add response interceptor for logging
apiClient.interceptors.response.use(
  (response) => {
    logger.info(`Успешный ответ от ${response.config.url}`, {
      status: response.status,
      dataSize: JSON.stringify(response.data).length
    });
    return response;
  },
  (error) => {
    logger.error(`Ошибка запроса к ${error.config?.url}`, {
      status: error.response?.status,
      message: error.message,
      data: error.response?.data
    });
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
    const startTime = Date.now();
    logger.info('Начало анализа записи', {
      blobSize: blob.size,
      blobType: blob.type
    });

    try {
      setRecordedBlob(blob);
      setAnalysisProgress({
        loading: true,
        message: 'Обработка видео...',
        percent: 20,
      });

      logger.debug('Установлен прогресс: Обработка видео (20%)');
      await new Promise(resolve => setTimeout(resolve, 500));

      setAnalysisProgress(p => ({...p, percent: 40, message: 'Загрузка на сервер...'}));
      logger.debug('Установлен прогресс: Загрузка на сервер (40%)');

      await new Promise(resolve => setTimeout(resolve, 500));
      
      if (!blob || blob.size === 0) {
        const errorMsg = 'Записанное видео слишком короткое или повреждено';
        logger.error(errorMsg, { blobSize: blob?.size });
        throw new Error(errorMsg);
      }

      const formData = new FormData();
      formData.append('video', blob, `recording_${Date.now()}.webm`);

      setAnalysisProgress({
        loading: true,
        message: 'Анализ нейросетью...',
        percent: 60,
      });

      logger.info('Отправка видео на анализ', {
        url: `${API_BASE_URL}/fatigue/analyze`,
        fileName: `recording_${Date.now()}.webm`,
        formDataSize: blob.size
      });
      
      // Реальный запрос к API
      try {
        // Используем apiClient с интерсепторами аутентификации
        const response = await apiClient.post('/fatigue/analyze', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / (progressEvent.total || 100));
            setAnalysisProgress(p => ({
              ...p,
              percent: 40 + Math.min(percentCompleted / 2, 40), // от 40% до 80%
            }));
            logger.debug(`Прогресс загрузки: ${percentCompleted}%`);
          }
        });

        setAnalysisProgress({
          loading: false,
          message: '',
          percent: 100,
        });

        const analysisTime = Date.now() - startTime;
        logger.info('Анализ успешно завершен', {
          duration: `${analysisTime}ms`,
          result: response.data
        });

        if (response.data) {
          setAnalysisResult(response.data);
          if (onSuccess) onSuccess(response.data);
        }
      } catch (apiError: any) {
        logger.error('Ошибка API при анализе', apiError);
        
        if (apiError.response?.status === 401) {
          logger.warn('Ошибка авторизации - перенаправление на страницу входа');
          toast({
            title: "Ошибка авторизации",
            description: "Необходимо выполнить вход в систему. Перенаправление на страницу входа...",
            variant: "destructive"
          });
          
          setTimeout(() => {
            window.location.href = '/login';
          }, 2000);
          return;
        }
        
        // Проверяем, является ли это ошибкой "лицо не обнаружено"
        if (apiError.response?.status === 400 && apiError.response?.data?.error?.includes('face')) {
          setAnalysisProgress({loading: false, message: '', percent: 0});
          
          logger.warn('Лицо не обнаружено в видео', apiError.response.data);
          
          toast({
            title: "Лицо не обнаружено",
            description: "Попробуйте записать видео с лучшим освещением, расположив лицо по центру кадра",
            variant: "destructive"
          });
          return;
        }
        
        logger.error('Соединение с API недоступно - переход в демо-режим', apiError);
        
        toast({
          title: "Ошибка соединения с API",
          description: `${apiError.message}. Проверьте что сервер запущен на порту 5000. Временно используем демо-данные.`,
          variant: "destructive"
        });
        
        // Фолбек - генерируем результат для демо, если API недоступен
        setTimeout(() => {
          setAnalysisProgress({loading: false, message: '', percent: 0});
          
          const mockResult = {
            analysis_id: Math.floor(Math.random() * 1000) + 1,
            fatigue_level: Math.random() > 0.6 ? 'High' : Math.random() > 0.3 ? 'Medium' : 'Low',
            neural_network_score: Math.random(),
            analysis_date: formatDate(new Date().toISOString()),
            video_path: '/videos/test.mp4'
          };
          
          logger.info('Сгенерирован демо-результат', mockResult);
          
          setAnalysisResult(mockResult);
          if (onSuccess) onSuccess(mockResult);
          
          toast({
            title: "Демо-режим",
            description: "API недоступно. Запустите Flask сервер на порту 5000.",
            variant: "default"
          });
        }, 1000);
      }
      
    } catch (error) {
      const analysisTime = Date.now() - startTime;
      logger.error('Критическая ошибка анализа', {
        error,
        duration: `${analysisTime}ms`
      });
      
      setAnalysisProgress({loading: false, message: '', percent: 0});
      toast({
        title: "Ошибка анализа",
        description: error instanceof Error ? error.message : "Неизвестная ошибка",
        variant: "destructive"
      });
    }
  };

  const saveToHistory = async (blob: Blob) => {
    logger.info('Начало сохранения записи в историю', {
      blobSize: blob.size,
      blobType: blob.type
    });

    try {
      setAnalysisProgress({
        loading: true,
        message: 'Сохранение записи...',
        percent: 50,
      });

      const formData = new FormData();
      formData.append('video', blob, `history_${Date.now()}.webm`);
      
      try {
        logger.info('Отправка запроса на сохранение записи');
        
        // Сохраняем запись в базу данных
        const response = await apiClient.post('/fatigue/save-recording', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          }
        });
        
        setAnalysisProgress({loading: false, message: '', percent: 0});
        
        logger.info('Запись успешно сохранена', response.data);
        
        toast({
          title: "Запись сохранена",
          description: "Видео успешно сохранено в базе данных"
        });
        return response.data;
      } catch (apiError: any) {
        logger.error('Ошибка API при сохранении', apiError);
        setAnalysisProgress({loading: false, message: '', percent: 0});
        
        if (apiError.response?.status === 401) {
          logger.warn('Ошибка авторизации при сохранении');
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
      logger.error('Критическая ошибка сохранения', error);
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
    logger.info('Начало анализа рейса', lastFlight);

    try {
      setAnalysisProgress({
        loading: true,
        message: 'Подготовка к анализу рейса...',
        percent: 20,
      });

      await new Promise(resolve => setTimeout(resolve, 500));

      setAnalysisProgress(p => ({...p, percent: 40, message: 'Загрузка видео рейса...'}));

      try {
        logger.info('Отправка запроса на анализ рейса');
        
        // Реальный запрос к API для анализа последнего рейса
        const response = await apiClient.post('/fatigue/analyze-flight', {
          flight_id: lastFlight?.flight_id,
        });

        setAnalysisProgress({loading: false, message: '', percent: 100});

        logger.info('Анализ рейса успешно завершен', response.data);
        
        if (response.data) {
          setAnalysisResult(response.data);
          if (onSuccess) onSuccess(response.data);
          return;
        }
      } catch (apiError: any) {
        logger.error('Ошибка API при анализе рейса', apiError);
        
        if (apiError.response?.status === 401) {
          logger.warn('Ошибка авторизации при анализе рейса');
          toast({
            title: "Ошибка авторизации",
            description: "Необходимо выполнить вход в систему",
            variant: "destructive"
          });
          return;
        }
        
        logger.info('API недоступно - переход в демо-режим для анализа рейса');
        
        toast({
          title: "Ошибка соединения с API",
          description: `${apiError.message}. Проверьте что сервер запущен на порту 5000. Временно используем демо-данные.`,
          variant: "destructive"
        });
        
        // Фолбек для демо-режима
        setAnalysisProgress({
          loading: true,
          message: 'Анализ нейросетью...',
          percent: 80,
        });

        const interval = setInterval(() => {
          setAnalysisProgress(p => ({
            ...p,
            percent: Math.min(p.percent + 1, 95),
          }));
        }, 100);

        setTimeout(() => {
          clearInterval(interval);
          setAnalysisProgress(p => ({...p, percent: 100}));
          setTimeout(() => {
            setAnalysisProgress({loading: false, message: '', percent: 0});
            
            const mockResult = {
              analysis_id: Math.floor(Math.random() * 1000) + 1,
              fatigue_level: Math.random() > 0.6 ? 'High' : Math.random() > 0.3 ? 'Medium' : 'Low',
              neural_network_score: Math.random(),
              analysis_date: formatDate(new Date().toISOString()),
              from_code: lastFlight?.from_code,
              to_code: lastFlight?.to_code,
              video_path: lastFlight?.video_path
            };
            
            logger.info('Сгенерирован демо-результат для рейса', mockResult);
            
            setAnalysisResult(mockResult);
            if (onSuccess) onSuccess(mockResult);
            
            toast({
              title: "Демо-режим",
              description: "API недоступно. Запустите Flask сервер на порту 5000.",
              variant: "default"
            });
          }, 500);
        }, 2000);
      }

    } catch (error) {
      logger.error('Критическая ошибка анализа рейса', error);
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
