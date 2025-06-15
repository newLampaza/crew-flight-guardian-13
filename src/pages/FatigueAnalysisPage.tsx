import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";
import { Brain, Activity, RefreshCw } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

// Import our components
import { VideoRecorder } from "@/components/fatigue-analysis/VideoRecorder";
import { FlightAnalyzer } from "@/components/fatigue-analysis/FlightAnalyzer";
import { AnalysisResult } from "@/components/fatigue-analysis/AnalysisResult";
import { AnalysisProgress } from "@/components/fatigue-analysis/AnalysisProgress";
import { FatigueStats } from "@/components/fatigue-analysis/FatigueStats";
import { FatigueStatusCard } from "@/components/fatigue-analysis/FatigueStatusCard";
import { AllAnalysesChart } from "@/components/fatigue-analysis/AllAnalysesChart";
import { FlightAnalysesChart } from "@/components/fatigue-analysis/FlightAnalysesChart";
import { useMediaRecorder } from "@/hooks/useMediaRecorder";
import { useFatigueAnalysis } from "@/hooks/useFatigueAnalysis";
import { useFlights } from "@/hooks/useFlights";

// !-------------------- ВАЖНО: Импортируем компонет для анализа по дням:
import { DayAnalysesAreaChart } from "@/components/fatigue-analysis/DayAnalysesAreaChart";

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

const fatigueLevelColor = (score: number) => {
  if (score > 70) return "bg-red-500";
  if (score > 30) return "bg-amber-400";
  return "bg-emerald-500";
};

const fatigueLevelLabel = (level?: string) => {
  if (!level) return "Неизвестно";
  if (level === "High" || level === "Высокий") return "Высокий";
  if (level === "Medium" || level === "Средний") return "Средний";
  if (level === "Low" || level === "Низкий") return "Низкий";
  return "Неизвестно";
};

// Мини-компонент для одной записи истории анализа
function HistoryAnalysisRow({
  analysis_id,
  analysis_type,
  analysis_date,
  neural_network_score,
  fatigue_level,
}: {
  analysis_id: number;
  analysis_type: "flight" | "realtime";
  analysis_date: string;
  neural_network_score: number;
  fatigue_level?: string;
}) {
  const score = Math.round((neural_network_score || 0) * 100);
  const formattedDate = (() => {
    try {
      // Улучшенный парсинг даты
      let isoString = analysis_date;
      if (analysis_date.includes(' ') && !analysis_date.includes('T')) {
        isoString = analysis_date.replace(' ', 'T');
      }
      if (isoString.includes('.')) {
        isoString = isoString.split('.')[0];
      }
      const dt = new Date(isoString);
      return dt.toLocaleString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return analysis_date;
    }
  })();

  const fatigueLevelColor = (score: number) => {
    if (score > 70) return "bg-red-500";
    if (score > 30) return "bg-amber-400";
    return "bg-emerald-500";
  };

  const fatigueLevelLabel = (level?: string) => {
    if (!level) return "Неизвестно";
    if (level === "High" || level === "Высокий") return "Высокий";
    if (level === "Medium" || level === "Средний") return "Средний";
    if (level === "Low" || level === "Низкий") return "Низкий";
    return "Неизвестно";
  };

  return (
    <div className="flex items-center justify-between rounded-xl bg-slate-800/80 dark:bg-slate-950/70 px-5 py-4 mb-3 last:mb-0 shadow-sm">
      <div className="flex items-center gap-3 min-w-0">
        <span className={`w-3 h-3 rounded-full shrink-0 ${fatigueLevelColor(score)}`} />
        <div>
          <div className="font-medium text-base text-white truncate">
            #{analysis_id}{" "}
            <span className="opacity-80 text-xs">
              (
              {analysis_type === "flight" ? "Рейс" : "Реальное время"}
              )
            </span>
          </div>
          <div className="text-xs text-slate-300">{formattedDate}</div>
        </div>
      </div>
      <div className="flex flex-col items-end min-w-[60px]">
        <span className="font-bold text-xl text-white">
          {score}%
        </span>
        <span className="text-xs mt-0.5 text-slate-300">{fatigueLevelLabel(fatigue_level)}</span>
      </div>
    </div>
  );
}

const FatigueAnalysisPage = () => {
  const [analysisMode, setAnalysisMode] = useState<'realtime' | 'flight' | null>(null);
  const [feedbackScore, setFeedbackScore] = useState(3);
  const [feedbackComment, setFeedbackComment] = useState<string>("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Загружаем реальные данные о рейсах
  const { data: flights = [], isLoading: flightsLoading } = useFlights();
  
  // Получаем последний завершённый рейс (arrival_time < now)
  const lastFlight = flights.length > 0 
    ? flights
        .filter(flight => {
          const now = new Date();
          const arrivalTime = flight.arrival_time ? new Date(flight.arrival_time) : null;
          return arrivalTime && arrivalTime < now;
        })
        .sort((a, b) => new Date(b.arrival_time).getTime() - new Date(a.arrival_time).getTime())[0] || null
    : null;

  // Use our custom hooks
  const { 
    analysisResult, 
    setAnalysisResult, 
    recordedBlob,
    analysisProgress, 
    historyData,
    lastUpdate, // Используем для принудительного обновления
    submitRecording, 
    analyzeFlight,
    submitFeedback,
    loadHistory,
    formatDate
  } = useFatigueAnalysis((result) => {
    // Analysis completed
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

  // Загрузка истории только один раз на маунте
  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Ручное обновление истории
  const handleManualRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await loadHistory();
      toast({
        title: "Обновлено",
        description: "История анализов обновлена"
      });
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось обновить историю",
        variant: "destructive"
      });
    } finally {
      setIsRefreshing(false);
    }
  }, [loadHistory]);

  // Feedback
  const handleSubmitFeedback = async () => {
    if (!analysisResult?.analysis_id) {
      toast({
        title: "Ошибка",
        description: "Не выбран анализ для оценки",
        variant: "destructive"
      });
      return;
    }
    const success = await submitFeedback(analysisResult.analysis_id, feedbackScore, feedbackComment);
    if (success) {
      setFeedbackComment("");
      setAnalysisResult(null);
      setAnalysisMode(null);
      cleanup();
    }
  };

  // Проверка: был ли уже проведён анализ последнего рейса
  const handleAnalyzeFlight = () => {
    if (!lastFlight) return;
    const existing = historyData.find(
      h => h.analysis_type === "flight" && h.flight_id === lastFlight.flight_id
    );
    if (existing) {
      toast({
        title: "Анализ уже выполнен",
        description: `Этот рейс (#${existing.flight_id}) уже проанализирован. Итог усталости: ${Math.round((existing.neural_network_score || 0) * 100)}% (${existing.fatigue_level || "не определено"}).`,
        variant: "warning"
      });
      return;
    }
    analyzeFlight(lastFlight);
  };

  // Manual refresh function
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
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Обновленная диаграмма: */}
          <DayAnalysesAreaChart historyData={historyData} />
          <FlightAnalysesChart historyData={historyData} />
        </div>

        {/* Status and History */}
        <div className="space-y-6">
          <FatigueStatusCard fatigueLevel={currentFatigueLevel} />

          {/* Improved History Card with Refresh Button */}
          <Card className="transition-all duration-200 overflow-hidden bg-[#101828] border border-[#222f44] rounded-2xl">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold text-lg text-white">
                    История анализов
                    <span className="text-xs text-slate-400 ml-2">
                      ({historyData.length})
                    </span>
                  </h3>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleManualRefresh}
                  disabled={isRefreshing}
                  className="h-8 w-8 p-0 text-slate-400 hover:text-white"
                >
                  <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                </Button>
              </div>
              <div className="space-y-0">
                {historyData.length > 0 ? (
                  historyData.slice(0, 6).map((item) => (
                    <HistoryAnalysisRow
                      key={`${item.analysis_id}-${item.analysis_date}-${lastUpdate}`}
                      analysis_id={item.analysis_id}
                      analysis_type={item.analysis_type}
                      analysis_date={item.analysis_date}
                      neural_network_score={item.neural_network_score}
                      fatigue_level={item.fatigue_level}
                    />
                  ))
                ) : (
                  <div className="text-sm text-slate-400 text-center py-6">
                    Нет данных анализов
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
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
          {/* Поле для комментария к отзыву */}
          <div className="mt-4">
            <label htmlFor="feedback-comment" className="block mb-1 text-sm text-muted-foreground">Комментарий к отзыву</label>
            <Textarea
              id="feedback-comment"
              value={feedbackComment}
              onChange={e => setFeedbackComment(e.target.value)}
              placeholder="Оставьте комментарий к анализу (необязательно)"
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FatigueAnalysisPage;
