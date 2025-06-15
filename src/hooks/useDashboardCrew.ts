
import { useQuery } from "@tanstack/react-query";
import axios from "axios";

// Create axios instance with auth interceptor like in AuthContext
const api = axios.create({
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
      const { data } = await api.get("/api/dashboard/crew");
      return Array.isArray(data) ? data : [];
    }
  });
};
