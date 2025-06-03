
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FlaskConical, AlertTriangle, Clock, CheckCircle2, Scale } from 'lucide-react';

interface FatigueStatusCardProps {
  fatigueLevel: number;
  lastUpdated?: string;
}

export const FatigueStatusCard: React.FC<FatigueStatusCardProps> = ({ 
  fatigueLevel, 
  lastUpdated = '5 мин назад' 
}) => {
  const getStatusInfo = (level: number) => {
    if (level >= 70) {
      return {
        status: 'Критический уровень',
        color: 'text-rose-500',
        icon: AlertTriangle,
        message: 'Требует немедленного внимания'
      };
    } else if (level >= 50) {
      return {
        status: 'Требует внимания',
        color: 'text-amber-500',
        icon: AlertTriangle,
        message: 'Повышенный уровень усталости'
      };
    } else {
      return {
        status: 'Нормальный уровень',
        color: 'text-emerald-500',
        icon: CheckCircle2,
        message: 'В пределах нормы'
      };
    }
  };

  const statusInfo = getStatusInfo(fatigueLevel);
  const StatusIcon = statusInfo.icon;

  return (
    <Card className="hover:shadow-lg transition-all duration-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FlaskConical className="h-5 w-5 text-primary" />
          Текущий статус
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center space-y-6">
          <div className="relative w-32 h-32">
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="64"
                cy="64"
                r="56"
                stroke="currentColor"
                strokeWidth="16"
                fill="none"
                className="text-muted/20"
              />
              <circle
                cx="64"
                cy="64"
                r="56"
                stroke="currentColor"
                strokeWidth="16"
                fill="none"
                strokeDasharray={351.8583}
                strokeDashoffset={351.8583 - (351.8583 * fatigueLevel) / 100}
                className={`transition-all duration-1000 ${
                  fatigueLevel >= 70 ? 'text-rose-500' : 
                  fatigueLevel >= 50 ? 'text-amber-500' : 
                  'text-emerald-500'
                }`}
              />
            </svg>
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
              <span className="text-3xl font-bold">{fatigueLevel}%</span>
              <span className="text-xs block text-muted-foreground">Усталость</span>
            </div>
          </div>
          
          <div className="w-full space-y-3">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center">
                <StatusIcon className={`h-4 w-4 mr-2 ${statusInfo.color}`} />
                <span className={statusInfo.color}>{statusInfo.status}</span>
              </div>
              <Scale className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center">
                <Clock className="h-4 w-4 text-muted-foreground mr-2" />
                <span className="text-muted-foreground">Обновлено {lastUpdated}</span>
              </div>
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            </div>
            <p className="text-xs text-center text-muted-foreground mt-2">
              {statusInfo.message}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
