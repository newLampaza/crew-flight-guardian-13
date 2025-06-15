
import { useQuery } from "@tanstack/react-query";
import axios from "axios";

export interface CrewMember {
  id: number;
  name: string;
  position: string;
}

export function useCrew() {
  return useQuery<CrewMember[]>({
    queryKey: ["crewData"],
    queryFn: async () => {
      const { data } = await axios.get("/api/crew");
      return data;
    },
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
  });
}
