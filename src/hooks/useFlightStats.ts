
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { useAuth } from "@/context/AuthContext";

export interface FlightStats {
  weeklyFlights: number;
  weeklyHours: number;
  monthlyFlights: number;
  monthlyHours: number;
}

export function useFlightStats() {
  const { isAuthenticated, loading } = useAuth();

  // Логи для отладки авторизации и состояния загрузки
  const enabled = isAuthenticated && !loading;
  console.log(
    "[useFlightStats] isAuthenticated:", isAuthenticated,
    "| loading:", loading,
    "| enabled:", enabled
  );

  // Временный axios интерцептор для Network-отладки (только dev)
  if (import.meta.env.DEV && !(window as any).__flightStatsAxiosSet) {
    axios.interceptors.request.use((config) => {
      console.log("[axios][request]", config.method?.toUpperCase(), config.url, config);
      return config;
    });
    axios.interceptors.response.use(
      (response) => {
        console.log("[axios][response]", response.config.url, response.status, response.data);
        return response;
      },
      (error) => {
        if (error.config) {
          console.error("[axios][error]", error.config.url, error.message, error.response?.data);
        } else {
          console.error("[axios][error]", error);
        }
        return Promise.reject(error);
      }
    );
    (window as any).__flightStatsAxiosSet = true;
  }

  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery<FlightStats>({
    queryKey: ["flight-stats"],
    queryFn: async () => {
      console.log("[useFlightStats][queryFn] Запрос на /api/crew/flight-stats (отправляю запрос)");
      const response = await axios.get("/api/crew/flight-stats");
      console.log("[useFlightStats][queryFn] Ответ получен:", response.data);
      return response.data;
    },
    enabled,
    retry: false,
  });

  console.log("[useFlightStats] useQuery -> isLoading:", isLoading, "| error:", error, "| data:", data);

  return { data, isLoading, error, refetch };
}
