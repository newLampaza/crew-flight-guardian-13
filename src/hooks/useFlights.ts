
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { formatDisplayDateTime, formatDisplayTime } from '../utils/dateUtils';

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
  video_path?: string;
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
    
    // Normalize datetime formats for consistency
    const normalizedFlights = response.data.map(flight => ({
      ...flight,
      departure_time: flight.departure_time,
      arrival_time: flight.arrival_time,
      // Add computed display fields for convenience
      departure_display: formatDisplayDateTime(flight.departure_time),
      arrival_display: formatDisplayDateTime(flight.arrival_time),
      departure_time_only: formatDisplayTime(flight.departure_time),
      arrival_time_only: formatDisplayTime(flight.arrival_time)
    }));
    
    return normalizedFlights;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error("[useFlights] Error fetching flights:", {
        status: error.response?.status,
        data: error.response?.data,
        url: error.config?.url
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
