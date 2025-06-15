
import { useQuery } from "@tanstack/react-query";
import axios from "axios";

export interface DashboardStats {
  weeklyFlights: number;
  weeklyHours: number;
  monthlyFlights: number;
  monthlyHours: number;
}

export interface CrewMember {
  id: number;
  name: string;
  position: string;
}

export interface DashboardData {
  stats: DashboardStats;
  crew: CrewMember[];
  flightStatus: {
    code: string;
    from: string;
    to: string;
    duration: string;
  };
}

const api = axios.create({
  baseURL: "http://localhost:5000",
  withCredentials: true,
  headers: { "Content-Type": "application/json" }
});

// Добавим авторизацию через токен, если потребуется
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("authToken") || localStorage.getItem("fatigue-guard-token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

async function fetchDashboard(): Promise<DashboardData> {
  const { data } = await api.get("/api/dashboard");
  return data; // предполагается, что структура совпадает с DashboardData
}

export function useDashboardData() {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: fetchDashboard,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1
  });
}
