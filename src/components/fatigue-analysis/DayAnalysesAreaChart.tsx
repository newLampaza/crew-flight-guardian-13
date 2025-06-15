
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from "recharts";
import { Activity } from "lucide-react";

type HistoryItem = {
  analysis_id: number;
  analysis_date: string;
  neural_network_score: number;
  fatigue_level?: string;
  flight_id?: number;
  analysis_type: "realtime" | "flight";
};

interface DayAnalysesAreaChartProps {
  historyData: HistoryItem[];
}

function formatDate(date: Date, mode: string) {
  // mode: day, week, month
  if (mode === "day") return date.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" });
  if (mode === "week") {
    // get ISO week number and year
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = Math.floor(
      (date.getTime() - firstDayOfYear.getTime()) / 86400000
    );
    const week = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
    return `${week} нед ${date.getFullYear()}`;
  }
  // month
  return date.toLocaleDateString("ru-RU", { month: "short", year: "2-digit" });
}

function groupData(historyData: HistoryItem[], mode: string) {
  // Группируем по дате(день/неделя/месяц)
  const map = new Map<string, { realtime: number[]; flight: number[] }>();

  historyData.forEach(item => {
    const date = new Date(item.analysis_date);
    const key = mode === "day"
      ? date.toISOString().slice(0, 10)
      : mode === "week"
        ? (() => {
            // get ISO week number with year
            const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
            const dayNum = d.getUTCDay() || 7;
            d.setUTCDate(d.getUTCDate() + 4 - dayNum);
            const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
            const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
            return `${d.getUTCFullYear()}-W${weekNum}`;
          })()
        : `${date.getFullYear()}-${(date.getMonth()+1).toString().padStart(2, "0")}`;

    if (!map.has(key)) {
      map.set(key, { realtime: [], flight: [] });
    }
    map.get(key)![item.analysis_type].push(item.neural_network_score);
  });

  // Формируем итоговые данные: среднее по каждой группе
  let out: any[] = [];
  Array.from(map.entries()).forEach(([key, value]) => {
    // График требует ось X в человекочитаемом виде
    let dateObj: Date;
    if (mode === "day") {
      dateObj = new Date(key);
    } else if (mode === "week") {
      const [year, weekRaw] = key.split("-W");
      // Find first day of ISO week
      const w = parseInt(weekRaw, 10);
      const d = new Date(Date.UTC(Number(year), 0, 1 + (w - 1) * 7));
      // Move to Monday
      if (d.getUTCDay() <= 4) d.setUTCDate(d.getUTCDate() - d.getUTCDay() + 1);
      else d.setUTCDate(d.getUTCDate() + 8 - d.getUTCDay());
      dateObj = d;
    } else {
      // month
      const [year, month] = key.split("-");
      dateObj = new Date(Number(year), Number(month)-1, 1);
    }

    out.push({
      period: formatDate(dateObj, mode),
      "Реальное время": value.realtime.length
        ? Math.round(100 * value.realtime.reduce((a, b) => a + b, 0) / value.realtime.length)
        : 0,
      "Рейс": value.flight.length
        ? Math.round(100 * value.flight.reduce((a, b) => a + b, 0) / value.flight.length)
        : 0,
    });
  });

  // Отсортируем по дате (asc)
  return out.sort((a, b) => {
    if (mode === "month") {
      const [m1, y1] = a.period.split(" ");
      const [m2, y2] = b.period.split(" ");
      return a.period.localeCompare(b.period);
    }
    return a.period.localeCompare(b.period);
  });
}

export const DayAnalysesAreaChart: React.FC<DayAnalysesAreaChartProps> = ({ historyData }) => {
  const [mode, setMode] = useState<"day" | "week" | "month">("day");

  const chartData = groupData(historyData, mode);

  return (
    <Card className="mb-6 hover:shadow-lg transition-all duration-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          Все анализы по периодам
        </CardTitle>
        <div className="mt-3">
          <Tabs value={mode} onValueChange={v => setMode(v as any)}>
            <TabsList>
              <TabsTrigger value="day">День</TabsTrigger>
              <TabsTrigger value="week">Неделя</TabsTrigger>
              <TabsTrigger value="month">Месяц</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] mt-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="colorRealtime" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.15}/>
                  <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorFlight" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.08}/>
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" opacity={0.07} />
              <XAxis 
                dataKey="period"
                stroke="#888888"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="#888888"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                domain={[0, 100]}
                tickFormatter={(value) => `${value}%`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(255,255,255,0.85)',
                  borderRadius: 8,
                  border: '1px solid #e5e7eb',
                  boxShadow: '0 2px 8px 0 rgba(0,0,0,.06)'
                }}
                formatter={(val: number) => `${val}%`}
              />
              <Area
                type="monotone"
                dataKey="Реальное время"
                stroke="#0ea5e9"
                strokeWidth={2}
                fill="url(#colorRealtime)"
              />
              <Area
                type="monotone"
                dataKey="Рейс"
                stroke="#22c55e"
                strokeWidth={2}
                fill="url(#colorFlight)"
              />
              <Legend />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};
