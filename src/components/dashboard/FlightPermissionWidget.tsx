
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PlaneTakeoff, AlertTriangle } from "lucide-react";

export const FlightPermissionWidget = () => {
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
                strokeDashoffset={351.8583 - (351.8583 * 70) / 100}
                className="text-amber-500 transition-all duration-1000"
              />
            </svg>
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
              <span className="text-3xl font-bold">70%</span>
              <span className="text-xs block text-muted-foreground">Готовность</span>
            </div>
          </div>

          <Badge className="bg-amber-500 text-white mb-3 py-1 px-3 text-sm">
            Условный допуск
          </Badge>

          <div className="w-full bg-amber-50 dark:bg-amber-500/10 p-3 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
              <div className="text-sm">
                <p className="font-medium">Требуются дополнительные проверки</p>
                <p className="text-muted-foreground">Пройдите повторный тест памяти и когнитивной гибкости</p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
