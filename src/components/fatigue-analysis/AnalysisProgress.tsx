
import React from 'react';
import { Brain } from 'lucide-react';

interface AnalysisProgressProps {
  loading: boolean;
  message: string;
  percent: number;
}

export const AnalysisProgress: React.FC<AnalysisProgressProps> = ({ 
  loading, 
  message, 
  percent 
}) => {
  if (!loading) return null;
  
  return (
    <div className="flex items-center justify-center p-8">
      <div className="bg-card p-8 rounded-2xl shadow-lg min-w-[300px] text-center border">
        <div className="relative w-16 h-16 mx-auto mb-4">
          <div className="absolute inset-0 rounded-full border-4 border-primary border-opacity-20"></div>
          <div className="absolute inset-0 rounded-full border-4 border-t-primary border-r-transparent border-b-transparent border-l-transparent animate-spin"></div>
          <Brain className="absolute inset-0 m-auto h-8 w-8 text-primary animate-pulse" />
        </div>
        
        <div className="space-y-3">
          <h3 className="font-medium text-lg">{message}</h3>
          <div className="w-full bg-secondary rounded-full h-2">
            <div 
              className="bg-primary h-2 rounded-full transition-all duration-300"
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="text-muted-foreground">{percent}% завершено</p>
        </div>
      </div>
    </div>
  );
};
