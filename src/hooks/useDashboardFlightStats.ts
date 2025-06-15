
import { useQuery } from "@tanstack/react-query";
import axios from "axios";

export const useDashboardFlightStats = () => {
  return useQuery({
    queryKey: ["dashboard-flight-stats"],
    queryFn: async () => {
      const { data } = await axios.get("/api/dashboard/flight-stats", { withCredentials: true });
      return data;
    }
  });
};
