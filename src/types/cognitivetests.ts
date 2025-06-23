export interface TestHistory {
  test_id: number;
  test_date: string;
  test_type: string;
  score: number;
  duration: number;
  details: string;
  cooldown_end?: string;
}

export type QuestionType = 
  | 'difference' 
  | 'count'
  | 'pattern'
  | 'logic'
  | 'math'
  | 'select'
  | 'sequence'
  | 'words'
  | 'images'
  | 'pairs'
  | 'matrix'
  | 'reaction'
  | 'memory'
  | 'matrix_selection'
  | 'cognitive';

export interface TestQuestion {
  id: string;
  type: QuestionType;
  question: string;
  options?: string[];
  image?: string;
  images?: string[];
  grid?: any[][];
  matrix?: number[][];
  stimulus?: string | string[];
  delay?: number;
  correct_answer?: string;
  answer_options?: string[];
  question_text?: string;
  animation?: string;
  multiple_select?: boolean;
  time_limit?: number;
}

export interface TestSession {
  test_id: string;
  questions: TestQuestion[];
  current_question: number;
  time_limit: number;
  total_questions: number;
  answers: Record<string, string>;
  skipped_questions: string[];
}

export interface TestResult {
  test_id: number;
  test_date: string;
  test_type: string;
  score: number;
  duration: number;
  details: {
    total_questions: number;
    correct_answers: number;
    error_analysis?: Record<string, number>;
  };
  mistakes: TestMistake[];
  cooldown_end?: string;
}

export interface TestMistake {
  question: string;
  user_answer: string;
  correct_answer: string;
}

export interface TestResultSummary {
  score: number;
  test_id: number;
  total_questions?: number;
  correct_answers?: number;
  cooldown_end?: string;
}

export interface QuestionResponse {
  questionId: string;
  answer: string;
  timeTaken?: number;
}

export interface TestDetails {
  question_type: string;
  attempts: number;
  correct: number;
  average_time?: number;
  error_rate?: number;
}

export interface DetailedTestResult extends TestResult {
  details: {
    total_questions: number;
    correct_answers: number;
    error_analysis: Record<string, number>;
    question_details: TestDetails[];
    average_response_time: number;
    performance_by_type: Record<string, {
      accuracy: number;
      average_time: number;
    }>;
  };
}
