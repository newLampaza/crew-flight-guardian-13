import { useState } from "react";
import { TestHistory, TestQuestion, TestResult, TestResultSummary } from "@/types/cognitivetests";
import { cognitiveTestsApi } from "@/api/cognitiveTestsApi";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/context/AuthContext";

export const useCognitiveTest = () => {
  const [activeTestId, setActiveTestId] = useState<string | null>(null);
  const [testInProgress, setTestInProgress] = useState(false);
  const [testComplete, setTestComplete] = useState(false);
  const [reviewingSkipped, setReviewingSkipped] = useState(false);
  const [currentTestSession, setCurrentTestSession] = useState<{
    testId: string;
    questions: TestQuestion[];
    timeLimit: number;
    currentQuestion: number;
    answers: Record<string, string>;
    skippedQuestions: string[];
  } | null>(null);
  const [testResults, setTestResults] = useState<TestResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { isAuthenticated, user, refreshToken } = useAuth();

  const startTest = async (testId: string) => {
    try {
      // Проверяем, аутентифицирован ли пользователь
      if (!isAuthenticated || !user) {
        toast({
          title: "Ошибка авторизации",
          description: "Пожалуйста, войдите в систему снова",
          variant: "destructive"
        });
        return;
      }

      // Обновляем токен для обеспечения валидности
      try {
        await refreshToken();
      } catch (refreshError) {
        console.error("Не удалось обновить токен:", refreshError);
        toast({
          title: "Ошибка авторизации",
          description: "Не удалось обновить токен. Пожалуйста, войдите снова",
          variant: "destructive"
        });
        return;
      }

      // Проверяем период перезарядки теста
      try {
        if (!testId) {
          toast({
            title: "Ошибка",
            description: "Недействительный ID теста",
            variant: "destructive"
          });
          return;
        }
        
        const cooldownCheck = await cognitiveTestsApi.checkTestCooldown(testId);
        if (cooldownCheck.in_cooldown) {
          const cooldownEnd = new Date(cooldownCheck.cooldown_end as string);
          const now = new Date();
          const diffMinutes = Math.ceil((cooldownEnd.getTime() - now.getTime()) / (1000 * 60));
          
          toast({
            title: "Тест недоступен",
            description: `Повторное прохождение будет доступно через ${diffMinutes} мин.`,
            variant: "warning"
          });
          return;
        }
      } catch (cooldownError) {
        console.error("Ошибка при проверке перезарядки:", cooldownError);
        toast({
          title: "Предупреждение",
          description: "Не удалось проверить перезарядку теста. Продолжаем запуск.",
          variant: "warning"
        });
      }

      setIsLoading(true);
      setActiveTestId(testId);
      
      const session = await cognitiveTestsApi.startTest(testId);
      
      setCurrentTestSession({
        testId: session.test_id,
        questions: session.questions,
        timeLimit: session.time_limit,
        currentQuestion: 0,
        answers: {},
        skippedQuestions: []
      });
      
      setTestInProgress(true);
      setTestComplete(false);
      setReviewingSkipped(false);
      setIsLoading(false);

      toast({
        title: "Тест начат",
        description: `Тест состоит из ${session.questions.length} вопросов`,
      });
    } catch (error) {
      console.error("Не удалось начать тест:", error);
      
      let errorMessage = "Не удалось начать тест";
      if (error.response?.status === 401) {
        errorMessage = "Ошибка авторизации. Пожалуйста, войдите в систему снова";
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      }
      
      toast({
        title: "Ошибка",
        description: errorMessage,
        variant: "destructive"
      });
      
      setActiveTestId(null);
      setIsLoading(false);
    }
  };

  const handleAnswer = (questionId: string, answer: string) => {
    if (!currentTestSession) return;
    
    const updatedAnswers = {
      ...currentTestSession.answers,
      [questionId]: answer
    };
    
    const updatedSkipped = currentTestSession.skippedQuestions.filter(id => id !== questionId);
    
    const nextQuestion = currentTestSession.currentQuestion + 1;
    
    if (reviewingSkipped) {
      const remainingSkipped = updatedSkipped.length;
      if (remainingSkipped === 0) {
        submitTest(currentTestSession.testId, updatedAnswers);
      } else {
        const nextSkippedId = updatedSkipped[0];
        const nextSkippedIndex = currentTestSession.questions.findIndex(q => q.id === nextSkippedId);
        
        setCurrentTestSession({
          ...currentTestSession,
          currentQuestion: nextSkippedIndex,
          answers: updatedAnswers,
          skippedQuestions: updatedSkipped
        });
      }
    } else {
      if (nextQuestion >= currentTestSession.questions.length) {
        if (updatedSkipped.length > 0) {
          setCurrentTestSession({
            ...currentTestSession,
            answers: updatedAnswers,
            skippedQuestions: updatedSkipped
          });
          setTestComplete(true);
        } else {
          submitTest(currentTestSession.testId, updatedAnswers);
        }
      } else {
        setCurrentTestSession({
          ...currentTestSession,
          currentQuestion: nextQuestion,
          answers: updatedAnswers,
          skippedQuestions: updatedSkipped
        });

        const progress = Math.round((nextQuestion / currentTestSession.questions.length) * 100);
        if (progress % 25 === 0) {
          toast({
            title: `Прогресс: ${progress}%`,
            description: `Выполнено ${nextQuestion} из ${currentTestSession.questions.length} вопросов`,
          });
        }
      }
    }
  };

  const handleSkipQuestion = () => {
    if (!currentTestSession) return;
    
    const currentQuestionId = currentTestSession.questions[currentTestSession.currentQuestion].id;
    const updatedSkipped = [...currentTestSession.skippedQuestions, currentQuestionId];
    const nextQuestion = currentTestSession.currentQuestion + 1;
    
    if (nextQuestion >= currentTestSession.questions.length) {
      setCurrentTestSession({
        ...currentTestSession,
        skippedQuestions: updatedSkipped
      });
      setTestComplete(true);
    } else {
      setCurrentTestSession({
        ...currentTestSession,
        currentQuestion: nextQuestion,
        skippedQuestions: updatedSkipped
      });
    }

    toast({
      title: "Вопрос пропущен",
      description: "Вы сможете вернуться к нему в конце теста",
    });
  };

  const reviewSkippedQuestions = () => {
    if (!currentTestSession || currentTestSession.skippedQuestions.length === 0) return;
    
    const firstSkippedId = currentTestSession.skippedQuestions[0];
    const firstSkippedIndex = currentTestSession.questions.findIndex(q => q.id === firstSkippedId);
    
    setCurrentTestSession({
      ...currentTestSession,
      currentQuestion: firstSkippedIndex
    });
    
    setReviewingSkipped(true);
    setTestComplete(false);
    setTestInProgress(true);
  };

  const finishTestWithSkipped = () => {
    if (!currentTestSession) return;
    submitTest(currentTestSession.testId, currentTestSession.answers);
  };

  const submitTest = async (testId: string, answers: Record<string, string>) => {
    try {
      setIsLoading(true);
      
      try {
        await refreshToken();
      } catch (refreshError) {
        console.error("Не удалось обновить токен перед отправкой:", refreshError);
      }
      
      const result = await cognitiveTestsApi.submitTest(testId, answers);
      const fullResults = await cognitiveTestsApi.getTestResults(result.test_id);
      
      setTestResults(fullResults);
      setTestInProgress(false);
      setTestComplete(true);
      setReviewingSkipped(false);
      
      let statusText = "удовлетворительно";
      if (result.score >= 80) statusText = "отлично";
      else if (result.score >= 60) statusText = "хорошо";
      else if (result.score < 40) statusText = "требуется улучшение";
      
      toast({
        title: "Тест завершен",
        description: `Ваш результат: ${result.score}% (${statusText})`,
      });
      
      setIsLoading(false);
      return fullResults;
    } catch (error) {
      console.error("Не удалось отправить результаты теста:", error);
      
      let errorMessage = "Не удалось отправить результаты теста";
      
      if (error.response?.status === 401) {
        errorMessage = "Ошибка авторизации. Пожалуйста, войдите в систему снова";
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      }
      
      toast({
        title: "Ошибка",
        description: errorMessage,
        variant: "destructive"
      });
      
      setIsLoading(false);
      return null;
    }
  };

  const closeTest = () => {
    setActiveTestId(null);
    setTestInProgress(false);
    setTestComplete(false);
    setReviewingSkipped(false);
    setCurrentTestSession(null);
    setTestResults(null);
  };

  const handleTimeUp = () => {
    if (!currentTestSession) return;
    
    toast({
      title: "Время истекло",
      description: "Тест будет автоматически завершен",
      variant: "warning"
    });
    
    submitTest(currentTestSession.testId, currentTestSession.answers);
  };

  return {
    activeTestId,
    testInProgress,
    testComplete,
    reviewingSkipped,
    currentTestSession,
    testResults,
    isLoading,
    startTest,
    handleAnswer,
    handleSkipQuestion,
    reviewSkippedQuestions,
    finishTestWithSkipped,
    closeTest,
    handleTimeUp
  };
};
