
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
  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery<FlightStats>({
    queryKey: ["flight-stats"],
    queryFn: async () => {
      const response = await axios.get("/api/crew/flight-stats");
      return response.data;
    },
    enabled: isAuthenticated && !loading,
    retry: false,
  });
  return { data, isLoading, error, refetch };
}
