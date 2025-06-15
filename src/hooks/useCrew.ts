
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
      console.log('Fetching crew data...');
      const { data } = await axios.get("/api/crew");
      console.log('Received crew data:', data, 'type:', typeof data, 'isArray:', Array.isArray(data));
      
      // Убеждаемся, что возвращаем массив
      if (!Array.isArray(data)) {
        console.warn('Crew data is not an array, returning empty array');
        return [];
      }
      
      return data;
    },
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
  });
}
