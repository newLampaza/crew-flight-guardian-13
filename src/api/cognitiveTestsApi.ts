
import axios from 'axios';
import { TestHistory, TestSession, TestResult, TestResultSummary } from '../types/cognitivetests';

const API_URL = import.meta.env.DEV ? 'http://localhost:5000/api' : '/api';

const apiClient = axios.create({
  baseURL: API_URL,
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
      console.warn('Authentication token missing for API request');
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Handle common response errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle 401 unauthorized errors by redirecting to login page
    if (error.response?.status === 401) {
      console.error('Authentication error:', error.response?.data || error.message);
      
      // Only redirect to login if we're not already on the login page
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export const cognitiveTestsApi = {
  getTestHistory: async (): Promise<TestHistory[]> => {
    const response = await apiClient.get('/cognitive-tests');
    return response.data || [];
  },

  startTest: async (testType: string): Promise<TestSession> => {
    const response = await apiClient.post('/tests/start', { test_type: testType });
    return response.data;
  },

  submitTest: async (testId: string, answers: Record<string, string>): Promise<TestResultSummary> => {
    const response = await apiClient.post('/tests/submit', {
      test_id: testId,
      answers: answers
    });
    return response.data;
  },

  getTestResults: async (testId: number): Promise<TestResult> => {
    const response = await apiClient.get(`/tests/results/${testId}`);
    return response.data;
  },
  
  checkTestCooldown: async (testType: string): Promise<{ in_cooldown: boolean, cooldown_end?: string }> => {
    try {
      const response = await apiClient.get(`/tests/cooldown/${testType}`);
      return response.data;
    } catch (error) {
      console.error('Ошибка при проверке перезарядки теста:', error);
      return { in_cooldown: false };
    }
  }
};

// API для работы с анализом утомляемости по видеозаписям полетов
export const fatigueAnalysisApi = {
  // Получить последний полет для анализа
  getLastFlight: async (): Promise<{ flight: any }> => {
    try {
      const response = await apiClient.get('/flights/last');
      return response.data;
    } catch (error) {
      console.error('Ошибка при получении данных о последнем полете:', error);
      return { flight: null };
    }
  },
  
  // Запросить анализ видеозаписи полета
  analyzeFlight: async (flightId: number): Promise<{ status: string; analysisId?: number }> => {
    try {
      const response = await apiClient.post('/fatigue-analysis/start', {
        flight_id: flightId
      });
      return response.data;
    } catch (error) {
      console.error('Ошибка при запуске анализа утомляемости:', error);
      throw error;
    }
  },
  
  // Получить результаты анализа
  getAnalysisResults: async (analysisId: number): Promise<any> => {
    const response = await apiClient.get(`/fatigue-analysis/results/${analysisId}`);
    return response.data;
  },
  
  // Получить историю анализов утомляемости
  getAnalysisHistory: async (): Promise<any[]> => {
    try {
      const response = await apiClient.get('/fatigue-analysis/history');
      return response.data || [];
    } catch (error) {
      console.error('Ошибка при получении истории анализов:', error);
      return [];
    }
  },
  
  // Отправить отзыв о результатах анализа
  submitFeedback: async (analysisId: number, rating: number, comments?: string): Promise<{ status: string }> => {
    try {
      const response = await apiClient.post('/fatigue-analysis/feedback', {
        analysis_id: analysisId,
        rating,
        comments
      });
      return response.data;
    } catch (error) {
      console.error('Ошибка при отправке отзыва:', error);
      throw error;
    }
  }
};
