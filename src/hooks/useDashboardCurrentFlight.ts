
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
      const { data } = await api.get("/api/dashboard/current-flight");
      console.log('[DashboardCurrentFlight] API response:', data);
      return data;
    },
    retry: false
  });
};
