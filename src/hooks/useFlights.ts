
import { useQuery } from "@tanstack/react-query";
import axios from "axios";

export interface FlightApi {
  flight_id: number;
  departure_time: string;
  arrival_time: string;
  duration?: number;
  from_code: string;
  from_city: string;
  to_code: string;
  to_city: string;
  aircraft: string;
  conditions: string;
  crew_name?: string;
}

// Create axios instance with base configuration
const api = axios.create({
  baseURL: 'http://localhost:5000',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  }
});

// Add request interceptor for JWT
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("authToken") || localStorage.getItem("fatigue-guard-token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

const fetchFlights = async (): Promise<FlightApi[]> => {
  try {
    const response = await api.get("/api/flights");
    
    if (!Array.isArray(response.data)) {
      if (response.data && Array.isArray(response.data.flights)) {
        return response.data.flights;
      }
      return [];
    }
    
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error("Error fetching flights:", {
        status: error.response?.status,
        data: error.response?.data,
      });
    }
    throw error; // Let react-query handle the error
  }
};

export function useFlights() {
  return useQuery({
    queryKey: ["flights"],
    queryFn: fetchFlights,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
