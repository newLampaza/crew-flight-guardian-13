
import { useQuery } from "@tanstack/react-query";
import axios from "axios";

export type DashboardUser = {
  name: string;
  position: string;
  role: string;
  avatarUrl: string;
};

export type FlightStats = {
  weeklyFlights: number;
  weeklyHours: number;
  monthlyFlights: number;
  monthlyHours: number;
};

export type CrewMember = {
  name: string;
  position: string;
};

export type Crew = {
  crew_name: string;
  members: CrewMember[];
};

export type FatigueResult = {
  fatigue_level: string;
  neural_network_score: number | string;
  analysis_date: string;
};

export type CognitiveTestResult = {
  type: string;
  date: string;
  score: string;
  details: string;
};

export type MedicalStatus = {
  check_date: string;
  expiry_date: string;
  status: string;
  doctor_name: string;
  notes: string;
};

type DashboardData = {
  user: DashboardUser;
  flightStats: FlightStats;
  crew: Crew;
  lastFatigue: FatigueResult | null;
  testsStatus: CognitiveTestResult[];
  medical: MedicalStatus | null;
};

export function useDashboardData() {
  return useQuery<DashboardData>({
    queryKey: ["dashboardData"],
    queryFn: async () => {
      const { data } = await axios.get("/api/dashboard");
      return data;
    },
    refetchOnWindowFocus: true,
    staleTime: 60 * 1000,
  });
}
