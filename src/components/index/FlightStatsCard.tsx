
import React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { PlaneTakeoff } from "lucide-react";

interface FlightStats {
  weeklyFlights: number;
  weeklyHours: number;
  monthlyFlights: number;
  monthlyHours: number;
}

const mockFlightStats: FlightStats = {
  weeklyFlights: 4,
  weeklyHours: 18,
  monthlyFlights: 16,
  monthlyHours: 72,
};

const FlightStatsCard: React.FC<{ stats?: FlightStats }> = ({ stats = mockFlightStats }) => (
  <Card className="hover-card">
    <CardHeader className="pb-2">
      <CardTitle className="text-2xl flex items-center gap-3">
        <PlaneTakeoff className="h-6 w-6 text-primary" />
        Статистика полетов
      </CardTitle>
      <CardDescription className="text-base">Текущая неделя и месяц</CardDescription>
    </CardHeader>
    <CardContent>
      <div className="space-y-5">
        <div className="flex justify-between items-center">
          <span className="text-base font-medium">Количество полетов за неделю</span>
          <span className="text-xl font-bold">{stats.weeklyFlights}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-base font-medium">Налет часов за неделю</span>
          <span className="text-xl font-bold">{stats.weeklyHours} ч</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-base font-medium">Количество полетов за месяц</span>
          <span className="text-xl font-bold">{stats.monthlyFlights}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-base font-medium">Налет часов за месяц</span>
          <span className="text-xl font-bold">{stats.monthlyHours} ч</span>
        </div>
      </div>
    </CardContent>
  </Card>
);

export default FlightStatsCard;
