
import React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { PlaneTakeoff } from "lucide-react";
import { useFlightStats } from "@/hooks/useFlightStats";

const FlightStatsCard: React.FC = () => {
  const { data, isLoading, error } = useFlightStats();

  return (
    <Card className="hover-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-2xl flex items-center gap-3">
          <PlaneTakeoff className="h-6 w-6 text-primary" />
          Статистика полетов
        </CardTitle>
        <CardDescription className="text-base">Текущая неделя и месяц</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-muted-foreground text-center py-6">Загрузка...</div>
        ) : error ? (
          <div className="text-destructive text-center py-6">
            Не удалось загрузить статистику.
          </div>
        ) : data ? (
          <div className="space-y-5">
            <div className="flex justify-between items-center">
              <span className="text-base font-medium">Количество полетов за неделю</span>
              <span className="text-xl font-bold">{data.weeklyFlights}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-base font-medium">Налет часов за неделю</span>
              <span className="text-xl font-bold">{data.weeklyHours} ч</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-base font-medium">Количество полетов за месяц</span>
              <span className="text-xl font-bold">{data.monthlyFlights}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-base font-medium">Налет часов за месяц</span>
              <span className="text-xl font-bold">{data.monthlyHours} ч</span>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
};

export default FlightStatsCard;
