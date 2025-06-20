
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

export const useDashboardFlightStats = () => {
  return useQuery({
    queryKey: ["dashboard-flight-stats"],
    queryFn: async () => {
      console.log('[DashboardFlightStats] Making API request to /api/dashboard/flight-stats');
      const { data } = await api.get("/api/dashboard/flight-stats");
      console.log('[DashboardFlightStats] API response:', data);
      return data;
    }
  });
};
