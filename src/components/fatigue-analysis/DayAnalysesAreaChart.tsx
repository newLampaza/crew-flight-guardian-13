
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  from_code?: string;
  to_code?: string;
};

interface DayAnalysesAreaChartProps {
  historyData: HistoryItem[];
}

function isToday(dateString: string) {
  const d = new Date(dateString);
  const today = new Date();
  return (
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
  );
}

export const DayAnalysesAreaChart: React.FC<DayAnalysesAreaChartProps> = ({ historyData }) => {
  // берем только анализы за сегодня
  const todayAnalyses = historyData.filter((h) => isToday(h.analysis_date));

  // Prepare chart data, по времени (часы/минуты)
  const chartData = todayAnalyses
    .sort((a, b) => new Date(a.analysis_date).getTime() - new Date(b.analysis_date).getTime())
    .map((item) => ({
      time: new Date(item.analysis_date).toLocaleTimeString("ru-RU", {
        hour: "2-digit",
        minute: "2-digit"
      }),
      "Усталость": Math.round((item.neural_network_score || 0) * 100),
    }));

  return (
    <Card className="mb-6 hover:shadow-lg transition-all duration-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          Все анализы за день
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[250px] mt-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="colorFatigue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" opacity={0.07} />
              <XAxis 
                dataKey="time"
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
                dataKey="Усталость"
                stroke="#0ea5e9"
                strokeWidth={2}
                fill="url(#colorFatigue)"
              />
              <Legend />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};
