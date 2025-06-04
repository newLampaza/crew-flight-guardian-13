
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { Plane, Clock, AlertTriangle } from 'lucide-react';

interface FlightAnalysesChartProps {
  historyData: Array<{
    analysis_id: number;
    neural_network_score: number;
    analysis_date: string;
    fatigue_level?: string;
    flight_id?: number;
    from_code?: string;
    to_code?: string;
  }>;
}

export const FlightAnalysesChart: React.FC<FlightAnalysesChartProps> = ({ historyData }) => {
  const [chartType, setChartType] = useState<'bar' | 'pie'>('bar');

  // Фильтруем только анализы рейсов за текущий день
  const getTodayFlightAnalyses = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return historyData.filter(item => {
      const itemDate = new Date(item.analysis_date);
      return item.flight_id && // Только анализы рейсов
             itemDate >= today && 
             itemDate < tomorrow;
    });
  };

  const flightAnalyses = getTodayFlightAnalyses();

  // Подготовка данных для гистограммы по рейсам
  const prepareBarChartData = () => {
    return flightAnalyses.map((item, index) => ({
      flight: item.from_code && item.to_code 
        ? `${item.from_code}-${item.to_code}` 
        : `Рейс ${item.flight_id}`,
      fatigue_score: Math.round((item.neural_network_score || 0) * 100),
      flight_id: item.flight_id,
      time: new Date(item.analysis_date).toLocaleTimeString('ru-RU', { 
        hour: '2-digit', 
        minute: '2-digit' 
      }),
      level: item.fatigue_level || 'Unknown'
    }));
  };

  // Подготовка данных для круговой диаграммы по уровням усталости
  const preparePieChartData = () => {
    const levels = { 'Low': 0, 'Medium': 0, 'High': 0, 'Unknown': 0 };
    
    flightAnalyses.forEach(item => {
      const score = (item.neural_network_score || 0) * 100;
      if (score <= 30) levels['Low']++;
      else if (score <= 70) levels['Medium']++;
      else levels['High']++;
    });

    return [
      { name: 'Низкий', value: levels['Low'], color: '#22c55e' },
      { name: 'Средний', value: levels['Medium'], color: '#f59e0b' },
      { name: 'Высокий', value: levels['High'], color: '#ef4444' }
    ].filter(item => item.value > 0);
  };

  const barChartData = prepareBarChartData();
  const pieChartData = preparePieChartData();
  
  const totalFlights = flightAnalyses.length;
  const avgFatigue = totalFlights > 0 
    ? Math.round(flightAnalyses.reduce((sum, item) => sum + (item.neural_network_score || 0) * 100, 0) / totalFlights)
    : 0;
  
  const highFatigueCount = flightAnalyses.filter(item => (item.neural_network_score || 0) * 100 > 70).length;

  const chartConfig = {
    fatigue_score: {
      label: "Уровень усталости",
      color: "hsl(var(--chart-1))",
    },
  };

  const getBarColor = (score: number) => {
    if (score <= 30) return '#22c55e'; // Зеленый - низкий
    if (score <= 70) return '#f59e0b'; // Желтый - средний
    return '#ef4444'; // Красный - высокий
  };

  return (
    <Card className="hover:shadow-lg transition-all duration-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Plane className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Анализы рейсов за сегодня</CardTitle>
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setChartType(chartType === 'bar' ? 'pie' : 'bar')}
          >
            {chartType === 'bar' ? 'Круговая' : 'Гистограмма'}
          </Button>
        </div>

        <div className="flex gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            <span>Рейсов: {totalFlights}</span>
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
        {totalFlights > 0 ? (
          <ChartContainer config={chartConfig} className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              {chartType === 'bar' ? (
                <BarChart data={barChartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="flight" 
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    angle={-45}
                    textAnchor="end"
                    height={80}
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
                            <div className="text-sm text-muted-foreground">
                              Время: {data.time}
                            </div>
                            <div className="text-sm">
                              Усталость: {data.fatigue_score}%
                            </div>
                            <div className="text-sm">
                              Уровень: {data.level === 'Low' ? 'Низкий' : 
                                       data.level === 'Medium' ? 'Средний' :
                                       data.level === 'High' ? 'Высокий' : 'Неизвестно'}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar
                    dataKey="fatigue_score"
                    radius={[4, 4, 0, 0]}
                    fill={(entry: any) => getBarColor(entry.fatigue_score)}
                  >
                    {barChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={getBarColor(entry.fatigue_score)} />
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
                              Количество: {data.value} рейсов
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
              <Plane className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Нет анализов рейсов за сегодня</p>
              <p className="text-sm mt-2">Анализы рейсов появятся здесь после их выполнения</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
