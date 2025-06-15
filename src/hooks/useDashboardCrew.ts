
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

export const useDashboardCrew = () => {
  return useQuery({
    queryKey: ["dashboard-crew"],
    queryFn: async () => {
      console.log('[DashboardCrew] Making API request to /api/dashboard/crew');
      const { data } = await api.get("/api/dashboard/crew");
      console.log('[DashboardCrew] API response:', data);
      return Array.isArray(data) ? data : [];
    }
  });
};
