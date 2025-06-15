
import { useQuery } from "@tanstack/react-query";
import axios from "axios";

// Create axios instance with same config as AuthContext
const api = axios.create({
  baseURL: 'http://localhost:5000',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add request interceptor for JWT
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('fatigue-guard-token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  }
);

export const useDashboardCurrentFlight = () => {
  return useQuery({
    queryKey: ["dashboard-current-flight"],
    queryFn: async () => {
      console.log('[DashboardCurrentFlight] Making API request to /api/dashboard/current-flight');
      
      try {
        const { data } = await api.get("/api/dashboard/current-flight");
        console.log('[DashboardCurrentFlight] API response:', data);
        
        // Проверяем, есть ли рейс и правильно используем isActive из ответа
        if (data && data.flight_number) {
          return {
            ...data,
            isActive: data.isActive || false  // Используем значение из API
          };
        }
        
        return null;
      } catch (error) {
        console.error('[DashboardCurrentFlight] Error:', error);
        return null;
      }
    },
    retry: false
  });
};
