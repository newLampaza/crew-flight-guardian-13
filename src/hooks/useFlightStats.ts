
import { useQuery } from "@tanstack/react-query";
import axios from "axios";

export interface FlightStats {
  weeklyFlights: number;
  weeklyHours: number;
  monthlyFlights: number;
  monthlyHours: number;
}

export function useFlightStats() {
  return useQuery<FlightStats>({
    queryKey: ["flightStats"],
    queryFn: async () => {
      const { data } = await axios.get("/api/flightstats");
      return data;
    },
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
  });
}
