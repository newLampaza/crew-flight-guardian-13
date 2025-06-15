
import { useQuery } from "@tanstack/react-query";
import axios from "axios";

export const useDashboardCrew = () => {
  return useQuery({
    queryKey: ["dashboard-crew"],
    queryFn: async () => {
      const { data } = await axios.get("/api/dashboard/crew", { withCredentials: true });
      return data;
    }
  });
};
