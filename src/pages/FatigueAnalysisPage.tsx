
import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";
import { Brain, Activity } from "lucide-react";

// Import our components
import { VideoRecorder } from "@/components/fatigue-analysis/VideoRecorder";
import { FlightAnalyzer } from "@/components/fatigue-analysis/FlightAnalyzer";
import { AnalysisResult } from "@/components/fatigue-analysis/AnalysisResult";
import { AnalysisProgress } from "@/components/fatigue-analysis/AnalysisProgress";
import { FatigueStats } from "@/components/fatigue-analysis/FatigueStats";
import { FatigueTrendChart } from "@/components/fatigue-analysis/FatigueTrendChart";
import { FatigueStatusCard } from "@/components/fatigue-analysis/FatigueStatusCard";
import { AllAnalysesChart } from "@/components/fatigue-analysis/AllAnalysesChart";
import { FlightAnalysesChart } from "@/components/fatigue-analysis/FlightAnalysesChart";
import { useMediaRecorder } from "@/hooks/useMediaRecorder";
import { useFatigueAnalysis } from "@/hooks/useFatigueAnalysis";
import { useFlights } from "@/hooks/useFlights";

import { 
  BatteryMedium,
  Timer,
  Eye,
  Coffee,
} from "lucide-react";

// Sample data for charts
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

const fatigueStats = [
  { 
    id: 1, 
    name: "Уровень усталости", 
    value: 65, 
    status: "warning" as const,
    icon: BatteryMedium,
    change: "+5%",
    details: "Повышенный уровень усталости",
    unit: "%"
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
    details: "В пределах нормы",
    unit: "%"
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

const FatigueAnalysisPage = () => {
  const [analysisMode, setAnalysisMode] = useState<'realtime' | 'flight' | null>(null);
  const [feedbackScore, setFeedbackScore] = useState(3);
  
  // Загружаем реальные данные о рейсах
  const { data: flights = [], isLoading: flightsLoading } = useFlights();
  
  // Получаем последний завершенный рейс
  const lastFlight = flights.length > 0 
    ? flights
        .filter(flight => flight.arrival_time && new Date(flight.arrival_time) < new Date())
        .sort((a, b) => new Date(b.arrival_time).getTime() - new Date(a.arrival_time).getTime())[0] || null
    : null;

  // Use our custom hooks
  const { 
    analysisResult, 
    setAnalysisResult, 
    recordedBlob,
    analysisProgress, 
    historyData,
    submitRecording, 
    analyzeFlight,
    submitFeedback,
    loadHistory,
    formatDate
  } = useFatigueAnalysis((result) => {
    console.log('Analysis completed:', result);
  });
  
  const { 
    videoRef, 
    recording, 
    cameraError,
    timeLeft,
    startRecording, 
    stopRecording,
    cleanup
  } = useMediaRecorder({ 
    onRecordingComplete: submitRecording 
  });

  // Load history on mount
  useEffect(() => {
    loadHistory();
  }, []);

  // Handle feedback submission
  const handleSubmitFeedback = async () => {
    if (!analysisResult?.analysis_id) {
      toast({
        title: "Ошибка",
        description: "Не выбран анализ для оценки",
        variant: "destructive"
      });
      return;
    }
    
    const success = await submitFeedback(analysisResult.analysis_id, feedbackScore);
    if (success) {
      setAnalysisResult(null);
      setAnalysisMode(null);
      cleanup();
    }
  };

  const handleAnalyzeFlight = () => {
    analyzeFlight(lastFlight);
  };

  const handleCloseDialog = () => {
    setAnalysisMode(null);
    cleanup();
  };

  const handleCloseResults = () => {
    setAnalysisResult(null);
    setAnalysisMode(null);
    cleanup();
  };

  // Вычисляем текущий уровень усталости на основе последнего анализа
  const currentFatigueLevel = historyData.length > 0 
    ? Math.round((historyData[0].neural_network_score || 0) * 100)
    : 65; // Значение по умолчанию

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

      {/* Stats Grid */}
      <FatigueStats stats={fatigueStats} />

      {/* Charts & Status Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <FatigueTrendChart data={monthlyFatigueData} />
        </div>

        {/* Status and History */}
        <div className="space-y-6">
          <FatigueStatusCard fatigueLevel={currentFatigueLevel} />

          {/* History Card */}
          <Card className="hover:shadow-lg transition-all duration-200 overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Activity className="h-5 w-5 text-primary" />
                <h3 className="font-medium">История анализов</h3>
              </div>
              <div className="space-y-3">
                {historyData.slice(0, 5).map((item) => (
                  <div key={`history-${item.analysis_id}`} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-md">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${
                        (item.neural_network_score || 0) > 0.7 ? 'bg-rose-500' : 
                        (item.neural_network_score || 0) > 0.4 ? 'bg-amber-500' : 
                        'bg-emerald-500'
                      }`} />
                      <div>
                        <div className="text-sm font-medium">#{item.analysis_id}</div>
                        <div className="text-xs text-muted-foreground">{item.analysis_date}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">
                        {Math.round((item.neural_network_score || 0) * 100)}%
                      </div>
                      {item.fatigue_level && (
                        <div className="text-xs text-muted-foreground">
                          {item.fatigue_level === 'High' ? 'Высокий' :
                           item.fatigue_level === 'Medium' ? 'Средний' :
                           item.fatigue_level === 'Low' ? 'Низкий' : 'Неизвестно'}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {historyData.length === 0 && (
                  <div className="text-sm text-muted-foreground text-center py-4">
                    Нет данных анализов
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Analytics Charts Section */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <AllAnalysesChart historyData={historyData} />
        <FlightAnalysesChart historyData={historyData} />
      </div>

      {/* Analysis Mode Dialog */}
      <Dialog open={analysisMode !== null} onOpenChange={(open) => !open && handleCloseDialog()}>
        <DialogContent className="sm:max-w-[700px] p-0 overflow-hidden max-h-[90vh] overflow-y-auto">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle className="text-xl font-semibold">Выберите тип анализа</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Выберите метод анализа усталости пилота
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex flex-col gap-6 p-6 pt-2">
            <VideoRecorder
              recording={recording}
              timeLeft={timeLeft}
              onStartRecording={startRecording}
              onStopRecording={stopRecording}
              analysisResult={analysisResult}
              cameraError={cameraError}
              videoRef={videoRef}
              recordedBlob={recordedBlob || undefined}
            />

            <FlightAnalyzer
              lastFlight={lastFlight}
              onAnalyzeFlight={handleAnalyzeFlight}
              formatDate={formatDate}
            />
          </div>
          
          <AnalysisProgress
            loading={analysisProgress.loading}
            message={analysisProgress.message}
            percent={analysisProgress.percent}
          />
        </DialogContent>
      </Dialog>

      {/* Results dialog */}
      <Dialog open={analysisResult !== null} onOpenChange={(open) => !open && handleCloseResults()}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
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
              onClose={handleCloseResults}
              onSubmitFeedback={handleSubmitFeedback}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FatigueAnalysisPage;
