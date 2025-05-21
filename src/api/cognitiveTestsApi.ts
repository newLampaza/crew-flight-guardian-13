import axios from 'axios';
import { TestHistory, TestSession, TestResult, TestResultSummary } from '../types/cognitivetests';
import { Flight, AnalysisResult, FatigueApiResponse } from '../types/fatigue';

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

// API for fatigue analysis through flight videos
export const fatigueAnalysisApi = {
  // Get the latest flight available for analysis
  getLastFlight: async (): Promise<{ flight: Flight | null }> => {
    try {
      const response = await apiClient.get<FatigueApiResponse>('/flights/last');
      return { flight: response.data.data || null };
    } catch (error) {
      console.error('Error fetching last flight data:', error);
      return { flight: null };
    }
  },
  
  // Request analysis of a flight recording
  analyzeFlight: async (flightId: number): Promise<{ status: string; analysisId?: number }> => {
    try {
      const response = await apiClient.post<FatigueApiResponse>('/fatigue-analysis/start', {
        flight_id: flightId
      });
      
      if (!response.data.success) {
        throw new Error(response.data.error || 'Unknown error starting analysis');
      }
      
      return {
        status: 'success',
        analysisId: response.data.data?.analysis_id
      };
    } catch (error) {
      console.error('Error starting fatigue analysis:', error);
      throw error;
    }
  },
  
  // Get analysis results by ID
  getAnalysisResults: async (analysisId: number): Promise<AnalysisResult> => {
    const response = await apiClient.get<FatigueApiResponse>(`/fatigue-analysis/results/${analysisId}`);
    
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to retrieve analysis results');
    }
    
    return response.data.data as AnalysisResult;
  },
  
  // Get history of previous analyses
  getAnalysisHistory: async (): Promise<AnalysisResult[]> => {
    try {
      const response = await apiClient.get<FatigueApiResponse>('/fatigue-analysis/history');
      
      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to retrieve analysis history');
      }
      
      return response.data.data || [];
    } catch (error) {
      console.error('Error fetching analysis history:', error);
      return [];
    }
  },
  
  // Submit feedback for an analysis
  submitFeedback: async (analysisId: number, rating: number, comments?: string): Promise<{ status: string }> => {
    try {
      const response = await apiClient.post<FatigueApiResponse>('/fatigue-analysis/feedback', {
        analysis_id: analysisId,
        rating,
        comments
      });
      
      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to submit feedback');
      }
      
      return { status: 'success' };
    } catch (error) {
      console.error('Error submitting feedback:', error);
      throw error;
    }
  },
  
  // Submit a recorded video for analysis
  analyzeVideo: async (videoBlob: Blob): Promise<AnalysisResult> => {
    const formData = new FormData();
    formData.append('video', videoBlob, `recording_${Date.now()}.webm`);
    
    const response = await apiClient.post<FatigueApiResponse>('/fatigue/analyze', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      }
    });
    
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to analyze video');
    }
    
    return response.data.data as AnalysisResult;
  },
  
  // Save a recorded video to history without analysis
  saveRecording: async (videoBlob: Blob): Promise<{ recordingId: number }> => {
    const formData = new FormData();
    formData.append('video', videoBlob, `history_${Date.now()}.webm`);
    
    const response = await apiClient.post<FatigueApiResponse>('/fatigue/save-recording', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      }
    });
    
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to save recording');
    }
    
    return { recordingId: response.data.data.recording_id };
  }
};
