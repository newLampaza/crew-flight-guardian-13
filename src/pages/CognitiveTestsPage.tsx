import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Brain, ActivitySquare, MousePointer, Timer, Loader2, BarChart, RefreshCw } from "lucide-react";
import { TestCard } from "@/components/cognitive-tests/TestCard";
import { TestDialog } from "@/components/cognitive-tests/TestDialog";
import { ResultsDialog } from "@/components/cognitive-tests/ResultsDialog";
import { useCognitiveTest } from "@/hooks/useCognitiveTest";
import { useTestHistory } from "@/hooks/useTestHistory";
import { useIsMobile } from "@/hooks/use-mobile";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

const testConfig = [
  {
    id: "attention",
    name: "Тест внимания",
    description: "Проверка способности концентрироваться, замечать детали и распределять внимание между несколькими объектами",
    duration: "5 минут",
    icon: <Brain className="h-5 w-5" />
  },
  {
    id: "reaction",
    name: "Тест реакции",
    description: "Измерение скорости и точности реакции на различные визуальные и когнитивные стимулы",
    duration: "4 минуты",
    icon: <MousePointer className="h-5 w-5" />
  },
  {
    id: "memory",
    name: "Тест памяти",
    description: "Проверка кратковременной памяти, способности к запоминанию последовательностей, образов и чисел",
    duration: "5 минут",
    icon: <ActivitySquare className="h-5 w-5" />
  },
  {
    id: "cognitive",
    name: "Тест когнитивных способностей",
    description: "Оценка скорости обработки информации, логического мышления и пространственного восприятия",
    duration: "5 минут",
    icon: <Timer className="h-5 w-5" />
  }
];

const CognitiveTestsPage = () => {
  const isMobile = useIsMobile();
  const { isAuthenticated, refreshToken } = useAuth();
  const [activeTab, setActiveTab] = useState("available");
  
  useEffect(() => {
    if (isAuthenticated) {
      refreshToken().catch(console.error);
    }
  }, [isAuthenticated, refreshToken]);
  
  const {
    activeTestId,
    testInProgress,
    testComplete,
    reviewingSkipped,
    currentTestSession,
    testResults,
    isLoading: testLoading,
    startTest,
    handleAnswer,
    handleSkipQuestion,
    reviewSkippedQuestions,
    finishTestWithSkipped,
    closeTest,
    handleTimeUp
  } = useCognitiveTest();

  const {
    testHistory,
    showResultDetails,
    setShowResultDetails,
    selectedTestResults,
    isLoading: historyLoading,
    getLastResult,
    viewTestDetails,
    refreshHistory,
    checkTestCooldown
  } = useTestHistory();

  useEffect(() => {
    if (testComplete && !testLoading) {
      refreshHistory();
    }
  }, [testComplete, testLoading, refreshHistory]);

  const activeTestConfig = testConfig.find(t => t.id === activeTestId);

  const handleStartTest = async () => {
    if (activeTestId) {
      const inCooldown = await checkTestCooldown(activeTestId);
      if (!inCooldown) {
        startTest(activeTestId);
      }
    }
  };

  const handleRetryTest = async (testId: string) => {
    setShowResultDetails(false);
    const inCooldown = await checkTestCooldown(testId);
    if (!inCooldown) {
      setTimeout(() => startTest(testId), 300);
    }
  };

  const handleCloseTest = () => {
    closeTest();
    if (testComplete) {
      refreshHistory();
    }
  };

  const renderAvailableTests = () => {
    if (historyLoading) {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="p-4 border rounded-lg space-y-2">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <div className="flex justify-between items-center pt-2">
                <Skeleton className="h-10 w-20" />
                <Skeleton className="h-10 w-20" />
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (!isAuthenticated) {
      return (
        <Alert>
          <AlertTitle>Требуется авторизация</AlertTitle>
          <AlertDescription>
            Для доступа к когнитивным тестам необходимо авторизоваться в системе.
          </AlertDescription>
        </Alert>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {testConfig.map((test) => (
          <TestCard
            key={test.id}
            id={test.id}
            name={test.name}
            description={test.description}
            duration={test.duration}
            lastResult={getLastResult(test.id)}
            icon={test.icon}
            onStartTest={startTest}
            onViewResults={viewTestDetails}
            showResultsButton={false}
          />
        ))}
      </div>
    );
  };

  const renderTestResults = () => {
    if (historyLoading) {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map(i => (
            <div key={i} className="p-4 border rounded-lg space-y-2">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <div className="flex justify-between items-center pt-2">
                <Skeleton className="h-10 w-20" />
                <Skeleton className="h-10 w-20" />
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (!isAuthenticated) {
      return (
        <Alert>
          <AlertTitle>Требуется авторизация</AlertTitle>
          <AlertDescription>
            Для доступа к результатам тестов необходимо авторизоваться в системе.
          </AlertDescription>
        </Alert>
      );
    }

    const testsWithResults = testConfig.filter(test => getLastResult(test.id) !== null);

    if (testsWithResults.length === 0) {
      return (
        <Alert>
          <AlertTitle>Нет результатов</AlertTitle>
          <AlertDescription>
            У вас пока нет пройденных тестов. Перейдите на вкладку "Доступные тесты" и пройдите хотя бы один тест.
          </AlertDescription>
        </Alert>
      );
    }

    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-medium">История результатов</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {testsWithResults.map((test) => (
            <TestCard
              key={test.id}
              id={test.id}
              name={test.name}
              description={test.description}
              duration={test.duration}
              lastResult={getLastResult(test.id)}
              icon={test.icon}
              onStartTest={startTest}
              onViewResults={viewTestDetails}
              mode='compact'
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Когнитивные тесты</h1>
        {historyLoading && <Loader2 className="h-5 w-5 animate-spin" />}
      </div>
      
      <Tabs 
        defaultValue="available" 
        className="w-full"
        value={activeTab}
        onValueChange={setActiveTab}
      >
        <TabsList className="mb-4 w-full flex-wrap">
          <TabsTrigger value="available" className="flex-1 flex items-center gap-1">
            <Brain className="h-4 w-4 md:mr-1" />
            <span className="hidden md:inline">Доступные тесты</span>
            <span className="md:hidden">Тесты</span>
          </TabsTrigger>
          <TabsTrigger value="results" className="flex-1 flex items-center gap-1">
            <BarChart className="h-4 w-4 md:mr-1" />
            <span className="hidden md:inline">Результаты тестов</span>
            <span className="md:hidden">Результаты</span>
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="available" className="space-y-4 animate-fade-in">
          <p className="text-muted-foreground mb-4">
            Когнитивные тесты помогают оценить ваше текущее психофизиологическое состояние и готовность к полету.
            Каждый тест состоит из нескольких вопросов и займет не более 5 минут.
          </p>
          {renderAvailableTests()}
        </TabsContent>
        
        <TabsContent value="results" className="space-y-4 animate-fade-in">
          <p className="text-muted-foreground mb-4">
            Здесь отображаются результаты ваших последних тестов. Нажмите "Подробнее" для просмотра детальной информации о каждом тесте.
          </p>
          {renderTestResults()}
        </TabsContent>
      </Tabs>
      
      <TestDialog
        isOpen={activeTestId !== null}
        testConfig={activeTestConfig}
        testInProgress={testInProgress}
        testComplete={testComplete}
        reviewingSkipped={reviewingSkipped}
        currentTestSession={currentTestSession}
        testResults={testResults}
        isLoading={testLoading}
        onClose={handleCloseTest}
        onStart={handleStartTest}
        onAnswer={handleAnswer}
        onSkip={handleSkipQuestion}
        onReviewSkipped={reviewSkippedQuestions}
        onFinishWithSkipped={finishTestWithSkipped}
        onTimeUp={handleTimeUp}
      />
      
      <ResultsDialog
        isOpen={showResultDetails}
        testResults={selectedTestResults}
        onClose={() => setShowResultDetails(false)}
      />
    </div>
  );
};

export default CognitiveTestsPage;
