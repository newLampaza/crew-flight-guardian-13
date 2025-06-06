
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
    console.log('[useFlights] Fetching flights from API...');
    const response = await api.get("/api/flights");
    
    console.log('[useFlights] Raw API response:', response.data);
    
    if (!Array.isArray(response.data)) {
      if (response.data && Array.isArray(response.data.flights)) {
        console.log('[useFlights] Found flights in nested data:', response.data.flights);
        return response.data.flights;
      }
      console.log('[useFlights] No valid flight data found, returning empty array');
      return [];
    }
    
    console.log('[useFlights] Direct flight array found:', response.data);
    
    // Log each flight's video_path for debugging
    response.data.forEach((flight: FlightApi, index: number) => {
      console.log(`[useFlights] Flight ${index + 1}:`, {
        flight_id: flight.flight_id,
        from_code: flight.from_code,
        to_code: flight.to_code,
        video_path: flight.video_path,
        arrival_time: flight.arrival_time,
        allFields: flight // Log all fields to see what we're getting
      });
    });
    
    // Check specifically for flight 31
    const flight31 = response.data.find((f: FlightApi) => f.flight_id === 31);
    if (flight31) {
      console.log('[useFlights] Flight 31 found with video_path:', flight31.video_path);
      console.log('[useFlights] Flight 31 all data:', flight31);
    } else {
      console.log('[useFlights] Flight 31 not found in response');
    }
    
    return response.data;
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
