
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { 
  BatteryMedium, 
  Timer, 
  Eye, 
  Coffee,
  TrendingUp,
  TrendingDown,
  Minus
} from 'lucide-react';

interface StatItem {
  id: number;
  name: string;
  value: number | string;
  status: 'success' | 'warning' | 'error';
  icon: React.ElementType;
  change: string;
  details: string;
  unit?: string;
}

interface FatigueStatsProps {
  stats: StatItem[];
}

export const FatigueStats: React.FC<FatigueStatsProps> = ({ stats }) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'text-emerald-500';
      case 'warning': return 'text-amber-500';
      case 'error': return 'text-rose-500';
      default: return 'text-slate-500';
    }
  };

  const getStatusBg = (status: string) => {
    switch (status) {
      case 'success': return 'bg-emerald-50 dark:bg-emerald-500/10';
      case 'warning': return 'bg-amber-50 dark:bg-amber-500/10';
      case 'error': return 'bg-rose-50 dark:bg-rose-500/10';
      default: return 'bg-slate-50 dark:bg-slate-500/10';
    }
  };

  const getTrendIcon = (change: string) => {
    if (change.startsWith('+')) return TrendingUp;
    if (change.startsWith('-')) return TrendingDown;
    return Minus;
  };

  const getTrendColor = (change: string, isPositiveGood: boolean = false) => {
    if (change.startsWith('+')) {
      return isPositiveGood ? 'text-emerald-500' : 'text-rose-500';
    }
    if (change.startsWith('-')) {
      return isPositiveGood ? 'text-rose-500' : 'text-emerald-500';
    }
    return 'text-slate-500';
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {stats.map((stat) => {
        const Icon = stat.icon;
        const TrendIcon = getTrendIcon(stat.change);
        const isConcentration = stat.name.includes('внимание');
        
        return (
          <Card key={stat.id} className="hover:shadow-lg transition-all duration-200">
            <CardContent className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div className={`${getStatusBg(stat.status)} p-3 rounded-lg`}>
                  <Icon className={`h-6 w-6 ${getStatusColor(stat.status)}`} />
                </div>
                <div className="flex items-center gap-1">
                  <TrendIcon className={`h-4 w-4 ${getTrendColor(stat.change, isConcentration)}`} />
                  <span className={`text-sm font-medium ${getTrendColor(stat.change, isConcentration)}`}>
                    {stat.change}
                  </span>
                </div>
              </div>
              
              <div className="space-y-2">
                <h3 className="font-medium text-sm text-muted-foreground">
                  {stat.name}
                </h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold">
                    {typeof stat.value === 'number' && stat.unit === '%' 
                      ? `${stat.value}%` 
                      : stat.value}
                  </span>
                  {stat.unit && stat.unit !== '%' && (
                    <span className="text-sm text-muted-foreground">{stat.unit}</span>
                  )}
                </div>
                
                {typeof stat.value === 'number' && stat.unit === '%' && (
                  <Progress 
                    value={stat.value} 
                    className="h-2 mt-2"
                    style={{
                      '--progress-background': stat.status === 'error' ? '#ef4444' : 
                                            stat.status === 'warning' ? '#f59e0b' : '#10b981'
                    } as React.CSSProperties}
                  />
                )}
                
                <p className="text-xs text-muted-foreground mt-1">
                  {stat.details}
                </p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
