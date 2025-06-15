
import { useState, useCallback } from "react";
import axios from "axios";
import { toast } from "@/components/ui/use-toast";

export interface AnalysisResult {
  analysis_id: number;
  fatigue_level: string;
  neural_network_score: number;
  video_path: string;
  from_code?: string;
  to_code?: string;
  resolution: string;
  fps: number;
  face_detection_ratio: number;
  frames_analyzed: number;
}

export interface HistoryData {
  analysis_id: number;
  analysis_date: string;
  fatigue_level: string;
  neural_network_score: number;
  video_path: string;
  analysis_type: 'flight' | 'realtime';
  from_code?: string;
  to_code?: string;
  departure_time?: string;
  flight_id?: number;
}

const api = axios.create({
  baseURL: 'http://localhost:5000',
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("authToken") || localStorage.getItem("fatigue-guard-token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export function useFatigueAnalysis(onAnalysisComplete?: (result: AnalysisResult) => void) {
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [analysisProgress, setAnalysisProgress] = useState({
    loading: false,
    message: "",
    percent: 0
  });
  const [historyData, setHistoryData] = useState<HistoryData[]>([]);

  const loadHistory = useCallback(async () => {
    try {
      const response = await api.get("/api/fatigue/history");
      setHistoryData(response.data || []);
    } catch (error) {
      console.error("Error loading history:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить историю анализов",
        variant: "destructive"
      });
    }
  }, []);

  const submitFeedback = useCallback(async (analysisId: number, score: number): Promise<boolean> => {
    try {
      await api.post("/api/fatigue/feedback", {
        analysis_id: analysisId,
        score: score
      });
      
      toast({
        title: "Успешно",
        description: "Отзыв отправлен"
      });
      
      return true;
    } catch (error: any) {
      let errorMessage = "Ошибка при отправке отзыва";
      
      if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      }
      
      toast({
        title: "Ошибка", 
        description: errorMessage,
        variant: "destructive"
      });
      
      return false;
    }
  }, []);

  const submitRecording = useCallback(async (blob: Blob) => {
    setRecordedBlob(blob);
    setAnalysisProgress({ loading: true, message: "Подготовка видео...", percent: 20 });

    try {
      const formData = new FormData();
      formData.append('video', blob, 'recording.webm');

      setAnalysisProgress({ loading: true, message: "Анализ видео...", percent: 60 });

      const response = await api.post("/api/fatigue/analyze", formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setAnalysisProgress({ loading: true, message: "Завершение анализа...", percent: 90 });

      const result = response.data;
      setAnalysisResult(result);
      
      // Reload history to include new analysis
      await loadHistory();
      
      setAnalysisProgress({ loading: false, message: "Анализ завершен", percent: 100 });
      
      if (onAnalysisComplete) {
        onAnalysisComplete(result);
      }

      toast({
        title: "Анализ завершен",
        description: `Уровень усталости: ${Math.round(result.neural_network_score * 100)}%`
      });

    } catch (error: any) {
      setAnalysisProgress({ loading: false, message: "", percent: 0 });
      
      let errorMessage = "Ошибка при анализе видео";
      if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      }

      toast({
        title: "Ошибка анализа",
        description: errorMessage,
        variant: "destructive"
      });
    }
  }, [onAnalysisComplete, loadHistory]);

  const analyzeFlight = useCallback(async (flight: any) => {
    if (!flight) {
      toast({
        title: "Ошибка",
        description: "Рейс не найден",
        variant: "destructive"
      });
      return;
    }

    setAnalysisProgress({ loading: true, message: "Анализ рейса...", percent: 50 });

    try {
      const response = await api.post("/api/fatigue/analyze-flight", {
        flight_id: flight.flight_id,
        video_path: flight.video_path
      });

      const result = response.data;
      setAnalysisResult(result);
      
      // Reload history to include new analysis
      await loadHistory();
      
      setAnalysisProgress({ loading: false, message: "Анализ завершен", percent: 100 });

      toast({
        title: "Анализ рейса завершен",
        description: `Уровень усталости: ${Math.round(result.neural_network_score * 100)}%`
      });

    } catch (error: any) {
      setAnalysisProgress({ loading: false, message: "", percent: 0 });
      
      let errorMessage = "Ошибка при анализе рейса";
      if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      }

      toast({
        title: "Ошибка анализа",
        description: errorMessage,
        variant: "destructive"
      });
    }
  }, [loadHistory]);

  const formatDate = useCallback((dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString('ru-RU', {
        year: 'numeric',
        month: '2-digit', 
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  }, []);

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
}
