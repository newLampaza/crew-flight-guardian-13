
import { useQuery } from "@tanstack/react-query";
import axios from "axios";

export const useDashboardCrew = () => {
  return useQuery({
    queryKey: ["dashboard-crew"],
    queryFn: async () => {
      try {
        const response = await axios.get("/api/dashboard/crew", { 
          withCredentials: true,
          validateStatus: () => true // allow all status codes for analysis
        });
        const { data, headers, status } = response;

        // Детектируем некорректный ответ: HTML или нет JSON
        if (
          typeof data === "string" &&
          (data.startsWith("<!DOCTYPE html") || (headers["content-type"] && headers["content-type"].includes("text/html")))
        ) {
          console.error("[DashboardCrew] ❌ Server returned HTML instead of JSON. Possibly lost session or token:", data.slice(0, 200));
          // Для реакта - выдаём конкретную ошибку как объект
          return {
            _error: "Некорректный ответ сервера. Вероятно, требуется повторно выполнить вход или проверить токен авторизации."
          };
        }

        if (Array.isArray(data)) {
          return data;
        }
        if (data && Array.isArray(data.results)) {
          return data.results;
        }
        // Мягкая диагностика
        console.warn("[DashboardCrew] Неожиданный формат данных:", data, "status:", status, "headers:", headers);

        return [];
      } catch (e) {
        console.error("Dashboard Crew API ERROR", e);
        return [];
      }
    }
  });
};
