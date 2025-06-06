
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

interface Flight {
  flight_id: number;
  crew_id: number;
  aircraft_id: number;
  from_code: string;
  to_code: string;
  departure_time: string;
  arrival_time: string;
  status: string;
  video_path?: string;
}

const API_BASE_URL = import.meta.env.PROD ? '/api' : 'http://localhost:5000/api';

const fetchFlights = async (): Promise<Flight[]> => {
  const token = localStorage.getItem('fatigue-guard-token');
  
  console.log('[useFlights] Fetching flights data...');
  
  const response = await axios.get(`${API_BASE_URL}/user/flights`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  
  console.log('[useFlights] Raw flights response:', response.data);
  
  // Логируем каждый рейс отдельно для детального анализа
  if (Array.isArray(response.data)) {
    response.data.forEach((flight, index) => {
      console.log(`[useFlights] Flight ${index + 1}:`, {
        flight_id: flight.flight_id,
        from_code: flight.from_code,
        to_code: flight.to_code,
        departure_time: flight.departure_time,
        arrival_time: flight.arrival_time,
        video_path: flight.video_path,
        video_path_type: typeof flight.video_path,
        video_path_null: flight.video_path === null,
        video_path_undefined: flight.video_path === undefined
      });
    });
  }
  
  return response.data;
};

export const useFlights = () => {
  const query = useQuery({
    queryKey: ['flights'],
    queryFn: fetchFlights,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
  
  // Логируем результат запроса
  console.log('[useFlights] Query result:', {
    isLoading: query.isLoading,
    isError: query.isError,
    data: query.data,
    error: query.error
  });
  
  return query;
};
