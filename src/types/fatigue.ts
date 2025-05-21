
export interface Flight {
  flight_id: number;
  from_code: string;
  to_code: string;
  departure_time: string;
  arrival_time?: string;
  video_path?: string;
  status?: string;
}

export interface AnalysisResult {
  analysis_id: number;
  flight_id?: number;
  fatigue_level: 'Low' | 'Medium' | 'High';
  neural_network_score: number;
  analysis_date: string;
  feedback_score?: number;
  feedback_comments?: string;
  video_path?: string;
  from_code?: string;
  to_code?: string;
  resolution?: string;
  fps?: number;
}

export interface FatigueApiResponse {
  success: boolean;
  message?: string;
  data?: any;
  error?: string;
}
