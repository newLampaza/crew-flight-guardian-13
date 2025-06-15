
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

const weekDaysRu = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

function getWeekdayName(date: Date) {
  // JS Sunday: 0, Monday: 1...
  return weekDaysRu[date.getDay()];
}
function padZero(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

function groupData(historyData: HistoryItem[], mode: "day" | "week" | "month") {
  if (!historyData || historyData.length === 0) return [];

  // Выделяем "реальное время" и "рейсы"
  const map = new Map<
    string,
    { realtime: number[]; flight: number[]; date: Date }
  >();

  // Находим наиболее свежую дату в данных для выбора дня/недели/месяца
  const dates = historyData.map(h => new Date(h.analysis_date));
  const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));

  if (mode === "day") {
    // Все за последний день
    const dayStr = maxDate.toISOString().slice(0, 10);
    historyData.forEach((item) => {
      const date = new Date(item.analysis_date);
      const curDayStr = date.toISOString().slice(0, 10);
      if (curDayStr === dayStr) {
        const timeKey = `${padZero(date.getHours())}:${padZero(date.getMinutes())}`;
        if (!map.has(timeKey)) {
          map.set(timeKey, { realtime: [], flight: [], date });
        }
        map.get(timeKey)![item.analysis_type].push(item.neural_network_score);
      }
    });
  } else if (mode === "week") {
    // Неделя — по дням с Пн по Вс, только неделя maxDate
    const monday = new Date(maxDate);
    monday.setDate(maxDate.getDate() - ((maxDate.getDay() + 6) % 7)); // Monday
    monday.setHours(0,0,0,0);

    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      // Группировка по yyyy-mm-dd (один столбец на каждый день недели)
      const dayKey = d.toISOString().slice(0, 10);
      if (!map.has(dayKey)) {
        map.set(dayKey, { realtime: [], flight: [], date: d });
      }
    }

    historyData.forEach(item => {
      const date = new Date(item.analysis_date);
      // Если день попадает в эту неделю
      const dayKey = date.toISOString().slice(0, 10);
      if (map.has(dayKey)) {
        map.get(dayKey)![item.analysis_type].push(item.neural_network_score);
      }
    });
  } else if (mode === "month") {
    // Месяц — по дням месяца, только месяц maxDate
    const year = maxDate.getFullYear();
    const month = maxDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(year, month, d);
      const dayKey = dateObj.toISOString().slice(0, 10);
      if (!map.has(dayKey)) {
        map.set(dayKey, { realtime: [], flight: [], date: dateObj });
      }
    }
    historyData.forEach(item => {
      const date = new Date(item.analysis_date);
      if (date.getFullYear() === year && date.getMonth() === month) {
        const dayKey = date.toISOString().slice(0, 10);
        map.get(dayKey)![item.analysis_type].push(item.neural_network_score);
      }
    });
  }

  // Формируем массив данных для графика в нужном виде для mode
  let out: any[] = [];
  Array.from(map.entries()).forEach(([key, value]) => {
    let xLabel = "";
    if (mode === "day") {
      xLabel = key; // HH:mm
    } else if (mode === "week") {
      xLabel = getWeekdayName(value.date); // Пн, Вт...
    } else if (mode === "month") {
      xLabel = String(value.date.getDate()); // 1, 2, ... 31
    }
    out.push({
      x: xLabel,
      "Реальное время": value.realtime.length
        ? Math.round(100 * value.realtime.reduce((a, b) => a + b, 0) / value.realtime.length)
        : 0,
      "Рейс": value.flight.length
        ? Math.round(100 * value.flight.reduce((a, b) => a + b, 0) / value.flight.length)
        : 0
    });
  });

  // Сортируем по x оси, чтобы AreaChart не строил рваную линию
  if (mode === "day") {
    out.sort((a, b) => a.x.localeCompare(b.x));
  } else if (mode === "week") {
    // По дням недели: Пн=1 ... Вс=0
    out.sort((a, b) => {
      const dayOrder = { "Пн": 1, "Вт": 2, "Ср": 3, "Чт": 4, "Пт": 5, "Сб": 6, "Вс": 0 };
      return (dayOrder[a.x] ?? 10) - (dayOrder[b.x] ?? 10);
    });
  } else if (mode === "month") {
    out.sort((a, b) => Number(a.x) - Number(b.x));
  }

  return out;
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
                dataKey="x"
                stroke="#888888"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                label={{
                  value:
                    mode === "day"
                      ? "Время"
                      : mode === "week"
                      ? "День недели"
                      : "День месяца",
                  position: "insideBottomRight",
                  offset: -8
                }}
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
                labelFormatter={(label: string) => {
                  if (mode === "day") return `Время: ${label}`;
                  if (mode === "week") return `День недели: ${label}`;
                  if (mode === "month") return `День месяца: ${label}`;
                  return label;
                }}
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
