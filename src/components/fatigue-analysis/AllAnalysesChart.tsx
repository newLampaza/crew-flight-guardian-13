
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { Calendar, BarChart3, TrendingUp } from 'lucide-react';

interface AllAnalysesChartProps {
  historyData: Array<{
    analysis_id: number;
    neural_network_score: number;
    analysis_date: string;
    fatigue_level?: string;
    flight_id?: number;
  }>;
}

type TimeFilter = 'day' | 'week' | 'month';

export const AllAnalysesChart: React.FC<AllAnalysesChartProps> = ({ historyData }) => {
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('week');
  const [chartType, setChartType] = useState<'line' | 'bar'>('line');

  // Функция для фильтрации данных по времени
  const filterDataByTime = (data: any[], filter: TimeFilter) => {
    const now = new Date();
    const filtered = data.filter(item => {
      const itemDate = new Date(item.analysis_date);
      const timeDiff = now.getTime() - itemDate.getTime();
      
      switch (filter) {
        case 'day':
          return timeDiff <= 24 * 60 * 60 * 1000; // 24 часа
        case 'week':
          return timeDiff <= 7 * 24 * 60 * 60 * 1000; // 7 дней
        case 'month':
          return timeDiff <= 30 * 24 * 60 * 60 * 1000; // 30 дней
        default:
          return true;
      }
    });

    return filtered;
  };

  // Группировка данных по дням/часам в зависимости от фильтра
  const processChartData = (data: any[], filter: TimeFilter) => {
    const filtered = filterDataByTime(data, filter);
    const grouped: { [key: string]: { total: number; count: number; date: string } } = {};

    filtered.forEach(item => {
      const date = new Date(item.analysis_date);
      let key: string;
      
      if (filter === 'day') {
        // Группировка по часам для дня
        key = `${date.getHours()}:00`;
      } else {
        // Группировка по дням для недели/месяца
        key = date.toLocaleDateString('ru-RU', { 
          day: 'numeric', 
          month: 'short' 
        });
      }

      if (!grouped[key]) {
        grouped[key] = { total: 0, count: 0, date: key };
      }
      
      grouped[key].total += Math.round((item.neural_network_score || 0) * 100);
      grouped[key].count += 1;
    });

    // Вычисляем средние значения
    return Object.values(grouped).map(group => ({
      period: group.date,
      average: group.count > 0 ? Math.round(group.total / group.count) : 0,
      count: group.count,
      fatigue_level: group.total / group.count > 70 ? 'Высокий' : 
                    group.total / group.count > 40 ? 'Средний' : 'Низкий'
    })).sort((a, b) => {
      if (filter === 'day') {
        return parseInt(a.period) - parseInt(b.period);
      }
      return new Date(a.period).getTime() - new Date(b.period).getTime();
    });
  };

  const chartData = processChartData(historyData, timeFilter);
  const totalAnalyses = filterDataByTime(historyData, timeFilter).length;
  const avgFatigue = chartData.length > 0 
    ? Math.round(chartData.reduce((sum, item) => sum + item.average, 0) / chartData.length)
    : 0;

  const chartConfig = {
    average: {
      label: "Средний уровень усталости",
      color: "hsl(var(--chart-1))",
    },
    count: {
      label: "Количество анализов",
      color: "hsl(var(--chart-2))",
    },
  };

  const getFilterLabel = () => {
    switch (timeFilter) {
      case 'day': return 'за день';
      case 'week': return 'за неделю';
      case 'month': return 'за месяц';
      default: return '';
    }
  };

  return (
    <Card className="hover:shadow-lg transition-all duration-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Все анализы {getFilterLabel()}</CardTitle>
          </div>
          
          <div className="flex gap-2">
            <div className="flex rounded-lg border">
              {(['day', 'week', 'month'] as TimeFilter[]).map((filter) => (
                <Button
                  key={filter}
                  variant={timeFilter === filter ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setTimeFilter(filter)}
                  className="rounded-none first:rounded-l-lg last:rounded-r-lg"
                >
                  {filter === 'day' ? 'День' : filter === 'week' ? 'Неделя' : 'Месяц'}
                </Button>
              ))}
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setChartType(chartType === 'line' ? 'bar' : 'line')}
            >
              <BarChart3 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            <span>Всего анализов: {totalAnalyses}</span>
          </div>
          <div>
            Средний уровень: {avgFatigue}%
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {chartData.length > 0 ? (
          <ChartContainer config={chartConfig} className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              {chartType === 'line' ? (
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="period" 
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis 
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    domain={[0, 100]}
                  />
                  <ChartTooltip 
                    content={<ChartTooltipContent />}
                    labelFormatter={(value) => `Период: ${value}`}
                  />
                  <Line
                    type="monotone"
                    dataKey="average"
                    stroke="var(--color-average)"
                    strokeWidth={2}
                    dot={{ fill: "var(--color-average)", strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              ) : (
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="period" 
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis 
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    domain={[0, 100]}
                  />
                  <ChartTooltip 
                    content={<ChartTooltipContent />}
                    labelFormatter={(value) => `Период: ${value}`}
                  />
                  <Bar
                    dataKey="average"
                    fill="var(--color-average)"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              )}
            </ResponsiveContainer>
          </ChartContainer>
        ) : (
          <div className="flex items-center justify-center h-[300px] text-muted-foreground">
            <div className="text-center">
              <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Нет данных анализов {getFilterLabel()}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
