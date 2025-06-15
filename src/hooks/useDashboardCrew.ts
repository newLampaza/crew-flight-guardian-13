
import { useQuery } from "@tanstack/react-query";
import axios from "axios";

export const useDashboardCrew = () => {
  return useQuery({
    queryKey: ["dashboard-crew"],
    queryFn: async () => {
      try {
        const { data } = await axios.get("/api/dashboard/crew", { withCredentials: true });
        console.log("Dashboard Crew API response:", data, "Type:", Array.isArray(data) ? "array" : typeof data);
        // Always return array — fallback to empty array if wrong type
        if (Array.isArray(data)) return data;
        if (data && Array.isArray(data.results)) return data.results;
        return [];
      } catch (e) {
        console.error("Dashboard Crew API ERROR", e);
        return [];
      }
    }
  });
};
