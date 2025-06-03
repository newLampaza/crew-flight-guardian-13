import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";
import { 
  Brain, 
  Activity, 
  Clock, 
  AlertTriangle,
  CheckCircle2,
  BatteryMedium,
  Timer,
  Eye,
  Coffee,
  LineChart as LineChartIcon,
  FlaskConical,
  Scale,
} from "lucide-react";

import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart
} from "recharts";

// Import our components
import { VideoRecorder } from "@/components/fatigue-analysis/VideoRecorder";
import { FlightAnalyzer } from "@/components/fatigue-analysis/FlightAnalyzer";
import { AnalysisResult } from "@/components/fatigue-analysis/AnalysisResult";
import { AnalysisProgress } from "@/components/fatigue-analysis/AnalysisProgress";
import { FatigueIndicator } from "@/components/fatigue-analysis/FatigueIndicator";
import { useMediaRecorder } from "@/hooks/useMediaRecorder";
import { useFatigueAnalysis } from "@/hooks/useFatigueAnalysis";

// Sample data
const monthlyFatigueData = [
  { date: "1 апр", усталость: 45, внимательность: 85, сон: 75 },
  { date: "4 апр", усталость: 50, внимательность: 80, сон: 70 },
  { date: "7 апр", усталость: 55, внимательность: 75, сон: 65 },
  { date: "10 апр", усталость: 60, внимательность: 70, сон: 60 },
  { date: "13 апр", усталость: 65, внимательность: 65, сон: 55 },
  { date: "16 апр", усталость: 60, внимательность: 70, сон: 65 },
  { date: "19 апр", усталость: 55, внимательность: 75, сон: 70 },
  { date: "22 апр", усталость: 50, внимательность: 80, сон: 75 },
  { date: "25 апр", усталость: 55, внимательность: 75, сон: 70 },
  { date: "28 апр", усталость: 62, внимательность: 68, сон: 65 },
  { date: "30 апр", усталость: 68, внимательность: 62, сон: 60 }
];

const indicators = [
  { 
    id: 1, 
    name: "Уровень усталости", 
    value: 65, 
    status: "warning" as const,
    icon: BatteryMedium,
    change: "+5%",
    details: "Повышенный уровень усталости"
  },
  { 
    id: 2, 
    name: "Время бодрствования", 
    value: "14ч 30м", 
    status: "warning" as const,
    icon: Timer,
    change: "+2ч",
    details: "Выше рекомендуемой нормы"
  },
  { 
    id: 3, 
    name: "Концентрация внимания", 
    value: 78, 
    status: "success" as const,
    icon: Eye,
    change: "-2%",
    details: "В пределах нормы"
  },
  { 
    id: 4, 
    name: "Качество сна", 
    value: "6ч 15м", 
    status: "error" as const,
    icon: Coffee,
    change: "-1ч 45м",
    details: "Ниже рекомендуемой нормы"
  }
];

// Sample history data
const sampleHistoryData = [
  { analysis_id: 1, neural_network_score: 0.65, analysis_date: "15 апр 2025, 14:30" },
  { analysis_id: 2, neural_network_score: 0.48, analysis_date: "12 апр 2025, 09:15" },
  { analysis_id: 3, neural_network_score: 0.72, analysis_date: "8 апр 2025, 18:22" },
  { analysis_id: 4, neural_network_score: 0.35, analysis_date: "5 апр 2025, 11:45" }
];

const FatigueAnalysisPage = () => {
  // State for the analysis mode and related data
  const [analysisMode, setAnalysisMode] = useState<'realtime' | 'flight' | null>(null);
  const [feedbackScore, setFeedbackScore] = useState(3);
  const [historyData, setHistoryData] = useState(sampleHistoryData);
  const [lastFlight, setLastFlight] = useState({
    flight_id: 1,
    from_code: "SVO",
    to_code: "LED",
    departure_time: "2025-04-15T14:30:00",
    video_path: "/videos/test.mp4"
  });

  // Use our custom hooks
  const { 
    analysisResult, 
    setAnalysisResult, 
    recordedBlob,
    analysisProgress, 
    submitRecording, 
    analyzeFlight,
    saveToHistory,
    formatDate
  } = useFatigueAnalysis((result) => {
    // Add the new analysis to the history data when successful
    setHistoryData(prev => [{
      analysis_id: result.analysis_id || Math.floor(Math.random() * 1000) + 1,
      neural_network_score: result.neural_network_score || Math.random(),
      analysis_date: formatDate(result.analysis_date || new Date().toISOString())
    }, ...prev]);
  });

  const { 
    videoRef, 
    stream,
    recording, 
    cameraError, 
    recordedChunks,
    startRecording, 
    stopRecording 
  } = useMediaRecorder({ 
    onDataAvailable: submitRecording 
  });

  // Handle feedback submission
  const submitFeedback = async () => {
    if (!analysisResult?.analysis_id) {
      toast({
        title: "Ошибка",
        description: "Не выбран анализ для оценки",
        variant: "destructive"
      });
      return;
    }
    
    try {
      // Имитация отправки отзыва в демонстрационных целях
      // В реальном приложении здесь был бы настоящий запрос к API
      // await axios.post('/api/fatigue/feedback', {
      //   analysis_id: analysisResult.analysis_id,
      //   score: feedbackScore
      // });
      
      toast({
        title: "Отзыв сохранен",
        description: `Спасибо за вашу оценку: ${feedbackScore} из 5`
      });
      setAnalysisResult(null);
      
    } catch (error) {
      toast({
        title: "Ошибка отправки отзыва",
        description: error instanceof Error ? error.message : "Неизвестная ошибка",
        variant: "destructive"
      });
    }
  };

  const handleAnalyzeFlight = () => {
    analyzeFlight(lastFlight);
  };

  return (
    <div className="space-y-8 animate-fade-in p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-1">Анализ усталости</h1>
          <p className="text-muted-foreground">
            Мониторинг состояния и оценка работоспособности
          </p>
        </div>

        <Button 
          onClick={() => setAnalysisMode('realtime')}
          className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-lg hover:shadow-xl transition-all duration-200"
        >
          <Brain className="mr-2 h-4 w-4" />
          Начать анализ
          {recording && <span className="inline-block animate-pulse text-white ml-2">● Запись</span>}
        </Button>
      </div>

      {/* Indicators Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {indicators.map(indicator => (
          <Card key={`indicator-${indicator.id}`} className="hover:shadow-lg transition-all duration-200">
            <CardContent className="p-0">
              <FatigueIndicator indicator={indicator} />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts & Status Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 hover:shadow-lg transition-all duration-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LineChartIcon className="h-5 w-5 text-primary" />
              Динамика показателей
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[350px] mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={monthlyFatigueData}
                  margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorУсталость" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorВнимательность" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorСон" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                  <XAxis 
                    dataKey="date" 
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
                    tickFormatter={(value) => `${value}%`}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'rgba(255, 255, 255, 0.8)',
                      borderRadius: '8px',
                      border: '1px solid rgba(0, 0, 0, 0.05)',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="усталость"
                    stroke="#0ea5e9"
                    strokeWidth={2}
                    fill="url(#colorУсталость)"
                  />
                  <Area
                    type="monotone"
                    dataKey="внимательность"
                    stroke="#22c55e"
                    strokeWidth={2}
                    fill="url(#colorВнимательность)"
                  />
                  <Area
                    type="monotone"
                    dataKey="сон"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    fill="url(#colorСон)"
                  />
                  <Legend />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Status Cards */}
        <div className="space-y-6">
          <Card className="hover:shadow-lg transition-all duration-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FlaskConical className="h-5 w-5 text-primary" />
                Текущий статус
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center space-y-6">
                <div className="relative w-32 h-32">
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
                      strokeDashoffset={351.8583 - (351.8583 * 65) / 100}
                      className="text-amber-500 transition-all duration-1000"
                    />
                  </svg>
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
                    <span className="text-3xl font-bold">65%</span>
                    <span className="text-xs block text-muted-foreground">Усталость</span>
                  </div>
                </div>
                
                <div className="w-full space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center">
                      <AlertTriangle className="h-4 w-4 text-amber-500 mr-1" />
                      <span>Требует внимания</span>
                    </div>
                    <Scale className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center">
                      <Clock className="h-4 w-4 text-muted-foreground mr-1" />
                      <span>Обновлено 5 мин назад</span>
                    </div>
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* History Card */}
          <Card className="hover:shadow-lg transition-all duration-200 overflow-hidden">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                История анализов
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {historyData.slice(0, 3).map((item) => (
                  <div key={`history-${item.analysis_id}`} className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-900 rounded-md">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${
                        (item.neural_network_score || 0) > 0.7 ? 'bg-rose-500' : 
                        (item.neural_network_score || 0) > 0.4 ? 'bg-amber-500' : 
                        'bg-emerald-500'
                      }`} />
                      <span className="text-sm">{item.analysis_date}</span>
                    </div>
                    <span className="font-medium">
                      {Math.round((item.neural_network_score || 0) * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Analysis Mode Dialog */}
      <Dialog open={analysisMode !== null} onOpenChange={() => setAnalysisMode(null)}>
        <DialogContent className="sm:max-w-[700px] p-0 overflow-hidden max-h-[90vh] overflow-y-auto">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle className="text-xl font-semibold">Выберите тип анализа</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Выберите метод анализа усталости пилота
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex flex-col gap-6 p-6 pt-2">
            {/* Real-time analysis block using our updated VideoRecorder component */}
            <VideoRecorder
              onAnalyze={submitRecording}
              analysisProgress={analysisProgress}
            />

            {/* Flight analysis block using our new FlightAnalyzer component */}
            <FlightAnalyzer
              lastFlight={lastFlight}
              onAnalyzeFlight={handleAnalyzeFlight}
              formatDate={formatDate}
            />
          </div>
          
          {/* Analysis loading overlay using our AnalysisProgress component */}
          <AnalysisProgress
            loading={analysisProgress.loading}
            message={analysisProgress.message}
            percent={analysisProgress.percent}
          />
        </DialogContent>
      </Dialog>

      {/* Results dialog using our new AnalysisResult component */}
      <Dialog open={analysisResult !== null} onOpenChange={(open) => !open && setAnalysisResult(null)}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">Результаты анализа</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Детальная информация о результатах анализа усталости
            </DialogDescription>
          </DialogHeader>
          
          {analysisResult && (
            <AnalysisResult
              analysisResult={analysisResult}
              feedbackScore={feedbackScore}
              setFeedbackScore={setFeedbackScore}
              onClose={() => setAnalysisResult(null)}
              onSubmitFeedback={submitFeedback}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FatigueAnalysisPage;
