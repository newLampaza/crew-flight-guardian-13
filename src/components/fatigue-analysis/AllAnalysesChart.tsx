
import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { Activity, Calendar, Clock, AlertTriangle } from 'lucide-react';

interface AllAnalysesChartProps {
  historyData: Array<{
    analysis_id: number;
    neural_network_score: number;
    analysis_date: string;
    fatigue_level?: string;
    flight_id?: number;
  }>;
}

export const AllAnalysesChart: React.FC<AllAnalysesChartProps> = ({ historyData }) => {
  const [periodFilter, setPeriodFilter] = useState<'day' | 'week' | 'month'>('week');
  const [chartType, setChartType] = useState<'bar' | 'pie'>('bar');

  // Фильтрация данных по периоду
  const filteredData = useMemo(() => {
    const now = new Date();
    const filterDate = new Date();
    
    switch (periodFilter) {
      case 'day':
        filterDate.setDate(now.getDate() - 1);
        break;
      case 'week':
        filterDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        filterDate.setMonth(now.getMonth() - 1);
        break;
    }

    return historyData.filter(item => {
      const itemDate = new Date(item.analysis_date);
      return itemDate >= filterDate;
    });
  }, [historyData, periodFilter]);

  // Подготовка данных для гистограммы
  const prepareBarChartData = () => {
    if (filteredData.length === 0) return [];

    // Группируем данные по дням
    const groupedData: Record<string, { total: number; count: number; high: number; medium: number; low: number }> = {};
    
    filteredData.forEach(item => {
      const date = new Date(item.analysis_date).toLocaleDateString('ru-RU', { 
        month: 'short', 
        day: 'numeric' 
      });
      
      if (!groupedData[date]) {
        groupedData[date] = { total: 0, count: 0, high: 0, medium: 0, low: 0 };
      }
      
      const score = (item.neural_network_score || 0) * 100;
      groupedData[date].total += score;
      groupedData[date].count += 1;
      
      if (score > 70) groupedData[date].high += 1;
      else if (score > 30) groupedData[date].medium += 1;
      else groupedData[date].low += 1;
    });

    return Object.entries(groupedData).map(([date, data]) => ({
      date,
      avg_fatigue: Math.round(data.total / data.count),
      count: data.count,
      high: data.high,
      medium: data.medium,
      low: data.low
    })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  };

  // Подготовка данных для круговой диаграммы
  const preparePieChartData = () => {
    const levels = { low: 0, medium: 0, high: 0 };
    
    filteredData.forEach(item => {
      const score = (item.neural_network_score || 0) * 100;
      if (score <= 30) levels.low++;
      else if (score <= 70) levels.medium++;
      else levels.high++;
    });

    return [
      { name: 'Низкий', value: levels.low, color: '#22c55e' },
      { name: 'Средний', value: levels.medium, color: '#f59e0b' },
      { name: 'Высокий', value: levels.high, color: '#ef4444' }
    ].filter(item => item.value > 0);
  };

  const barChartData = prepareBarChartData();
  const pieChartData = preparePieChartData();
  
  const totalAnalyses = filteredData.length;
  const avgFatigue = totalAnalyses > 0 
    ? Math.round(filteredData.reduce((sum, item) => sum + (item.neural_network_score || 0) * 100, 0) / totalAnalyses)
    : 0;
  
  const highFatigueCount = filteredData.filter(item => (item.neural_network_score || 0) * 100 > 70).length;

  const chartConfig = {
    avg_fatigue: {
      label: "Средний уровень усталости",
      color: "hsl(var(--chart-1))",
    },
  };

  const getBarColor = (score: number) => {
    if (score <= 30) return '#22c55e';
    if (score <= 70) return '#f59e0b';
    return '#ef4444';
  };

  const getPeriodLabel = () => {
    switch (periodFilter) {
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
            <Activity className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Все анализы {getPeriodLabel()}</CardTitle>
          </div>
          
          <div className="flex gap-2">
            <div className="flex border rounded-lg">
              {(['day', 'week', 'month'] as const).map((period) => (
                <Button
                  key={period}
                  variant={periodFilter === period ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setPeriodFilter(period)}
                  className="rounded-none first:rounded-l-lg last:rounded-r-lg"
                >
                  {period === 'day' ? 'День' : period === 'week' ? 'Неделя' : 'Месяц'}
                </Button>
              ))}
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setChartType(chartType === 'bar' ? 'pie' : 'bar')}
            >
              {chartType === 'bar' ? 'Круговая' : 'Гистограмма'}
            </Button>
          </div>
        </div>

        <div className="flex gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            <span>Анализов: {totalAnalyses}</span>
          </div>
          <div>
            Средний уровень: {avgFatigue}%
          </div>
          {highFatigueCount > 0 && (
            <div className="flex items-center gap-1 text-red-600">
              <AlertTriangle className="h-4 w-4" />
              <span>Высокая усталость: {highFatigueCount}</span>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {totalAnalyses > 0 ? (
          <ChartContainer config={chartConfig} className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              {chartType === 'bar' ? (
                <BarChart data={barChartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="date" 
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
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="rounded-lg border bg-background p-3 shadow-lg">
                            <div className="font-medium">{label}</div>
                            <div className="text-sm">
                              Средняя усталость: {data.avg_fatigue}%
                            </div>
                            <div className="text-sm">
                              Всего анализов: {data.count}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              Высокий: {data.high} | Средний: {data.medium} | Низкий: {data.low}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="avg_fatigue" radius={[4, 4, 0, 0]}>
                    {barChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={getBarColor(entry.avg_fatigue)} />
                    ))}
                  </Bar>
                </BarChart>
              ) : (
                <PieChart>
                  <Pie
                    data={pieChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pieChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <ChartTooltip 
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0];
                        return (
                          <div className="rounded-lg border bg-background p-3 shadow-lg">
                            <div className="font-medium">{data.payload.name}</div>
                            <div className="text-sm">
                              Количество: {data.value} анализов
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend />
                </PieChart>
              )}
            </ResponsiveContainer>
          </ChartContainer>
        ) : (
          <div className="flex items-center justify-center h-[300px] text-muted-foreground">
            <div className="text-center">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Нет анализов {getPeriodLabel()}</p>
              <p className="text-sm mt-2">Данные появятся здесь после проведения анализов</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
