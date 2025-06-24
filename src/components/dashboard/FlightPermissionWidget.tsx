
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PlaneTakeoff, AlertTriangle, CheckCircle } from "lucide-react";
import { useTestHistory } from "@/hooks/useTestHistory";

interface FlightPermissionWidgetProps {
  fatigueLevel: number;
}

export const FlightPermissionWidget = ({ fatigueLevel }: FlightPermissionWidgetProps) => {
  const { getLastResult } = useTestHistory();

  const testTypes = ['attention', 'reaction', 'memory', 'cognitive'];

  // Проверяем все ли тесты пройдены
  const allTestsPassed = testTypes.every(testType => {
    const result = getLastResult(testType);
    return result && result.status === 'passed' && !result.inCooldown;
  });

  // Проверяем уровень усталости (должен быть не больше 80%)
  const fatigueOk = fatigueLevel <= 80;

  // Общий допуск
  const isPermitted = allTestsPassed && fatigueOk;

  const getPermissionStatus = () => {
    if (isPermitted) {
      return {
        percentage: 100,
        status: 'Полный допуск',
        badge: 'Допущен к полету',
        color: 'text-green-500',
        badgeColor: 'bg-green-500',
        circleColor: 'text-green-500',
        icon: CheckCircle,
        message: 'Все требования выполнены'
      };
    } else {
      const reasons = [];
      if (!fatigueOk) reasons.push('Высокий уровень усталости');
      if (!allTestsPassed) reasons.push('Не все тесты пройдены');
      
      return {
        percentage: 0,
        status: 'Не допущен',
        badge: 'Нет допуска',
        color: 'text-red-500',
        badgeColor: 'bg-red-500',
        circleColor: 'text-red-500',
        icon: AlertTriangle,
        message: reasons.join(', ')
      };
    }
  };

  const permission = getPermissionStatus();
  const Icon = permission.icon;

  return (
    <Card className="hover-card bg-gradient-to-br from-primary/5 to-primary/10">
      <CardHeader className="pb-2">
        <CardTitle className="text-2xl flex items-center gap-3">
          <PlaneTakeoff className="h-6 w-6 text-primary" />
          Допуск к полету
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center py-2">
          <div className="relative w-32 h-32 mb-4">
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
                strokeDashoffset={351.8583 - (351.8583 * permission.percentage) / 100}
                className={`${permission.circleColor} transition-all duration-1000`}
              />
            </svg>
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
              <span className="text-3xl font-bold">{permission.percentage}%</span>
              <span className="text-xs block text-muted-foreground">Готовность</span>
            </div>
          </div>

          <Badge className={`${permission.badgeColor} text-white mb-3 py-1 px-3 text-sm`}>
            {permission.badge}
          </Badge>

          <div className={`w-full p-3 rounded-lg ${isPermitted ? 'bg-green-50 dark:bg-green-500/10' : 'bg-red-50 dark:bg-red-500/10'}`}>
            <div className="flex items-start gap-2">
              <Icon className={`h-5 w-5 mt-0.5 shrink-0 ${isPermitted ? 'text-green-500' : 'text-red-500'}`} />
              <div className="text-sm">
                <p className="font-medium">{permission.status}</p>
                <p className="text-muted-foreground">{permission.message}</p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
