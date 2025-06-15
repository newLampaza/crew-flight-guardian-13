
import { useQuery } from "@tanstack/react-query";
import axios from "axios";

export const useDashboardCurrentFlight = () => {
  return useQuery({
    queryKey: ["dashboard-current-flight"],
    queryFn: async () => {
      const { data } = await axios.get("/api/dashboard/current-flight", { withCredentials: true });
      return data;
    },
    retry: false
  });
};
