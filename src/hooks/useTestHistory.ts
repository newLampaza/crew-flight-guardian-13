
import { useState, useEffect } from "react";
import { TestHistory, TestResult, DetailedTestResult } from "@/types/cognitivetests";
import { cognitiveTestsApi } from "@/api/cognitiveTestsApi";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/context/AuthContext";

export const useTestHistory = () => {
  const [testHistory, setTestHistory] = useState<TestHistory[]>([]);
  const [showResultDetails, setShowResultDetails] = useState(false);
  const [selectedTestResults, setSelectedTestResults] = useState<DetailedTestResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (isAuthenticated) {
      fetchTestHistory();
    }
  }, [isAuthenticated]);

  const fetchTestHistory = async () => {
    if (!isAuthenticated) {
      setTestHistory([]);
      setIsLoading(false);
      return;
    }
    
    try {
      const history = await cognitiveTestsApi.getTestHistory();
      setTestHistory(Array.isArray(history) ? history : []);
    } catch (error) {
      console.error("Не удалось загрузить историю тестов:", error);
      
      // Более информативное сообщение об ошибке
      let errorMessage = "Не удалось загрузить историю тестов";
      if (error.response?.status === 401) {
        errorMessage = "Ошибка авторизации. Пожалуйста, войдите в систему снова";
      }
      
      toast({
        title: "Ошибка",
        description: errorMessage,
        variant: "destructive"
      });
      
      setTestHistory([]);
    } finally {
      setIsLoading(false);
    }
  };

  const getLastResult = (testType: string) => {
    if (!testHistory || !Array.isArray(testHistory) || testHistory.length === 0) {
      return null;
    }
    
    const results = testHistory.filter(test => test.test_type === testType);
    if (results.length === 0) return null;
    
    results.sort((a, b) => new Date(b.test_date).getTime() - new Date(a.test_date).getTime());
    const lastTest = results[0];
    
    let status = "failed";
    if (lastTest.score >= 85) status = "passed";
    else if (lastTest.score >= 70) status = "warning";
    
    // Проверяем, находится ли тест в перезарядке
    let inCooldown = false;
    let cooldownEnd = null;
    
    if (lastTest.cooldown_end) {
      const cooldownEndDate = new Date(lastTest.cooldown_end);
      if (cooldownEndDate > new Date()) {
        inCooldown = true;
        cooldownEnd = lastTest.cooldown_end;
      }
    }
    
    return {
      status,
      score: lastTest.score,
      date: new Date(lastTest.test_date).toLocaleDateString('ru-RU'),
      errors: [],
      inCooldown,
      cooldownEnd
    };
  };

  const checkTestCooldown = async (testType: string): Promise<boolean> => {
    try {
      const response = await cognitiveTestsApi.checkTestCooldown(testType);
      if (response.in_cooldown) {
        const cooldownEnd = new Date(response.cooldown_end as string);
        const now = new Date();
        const diffMinutes = Math.ceil((cooldownEnd.getTime() - now.getTime()) / (1000 * 60));
        
        toast({
          title: "Тест недоступен",
          description: `Тест будет доступен через ${diffMinutes} мин.`,
          variant: "warning"
        });
        return true;
      }
      return false;
    } catch (error) {
      console.error("Ошибка при проверке перезарядки теста:", error);
      return false;
    }
  };

  const viewTestDetails = async (testId: string) => {
    try {
      setIsLoading(true);
      
      // Ensure testHistory is an array before filtering
      if (!Array.isArray(testHistory)) {
        toast({
          title: "Ошибка",
          description: "История тестов не загружена",
          variant: "destructive"
        });
        setIsLoading(false);
        return;
      }
      
      const tests = testHistory.filter(test => test.test_type === testId);
      if (tests.length === 0) {
        toast({
          title: "Информация",
          description: "У вас еще нет результатов для этого теста",
        });
        setIsLoading(false);
        return;
      }
      
      tests.sort((a, b) => new Date(b.test_date).getTime() - new Date(a.test_date).getTime());
      const lastTestId = tests[0].test_id;
      
      const result = await cognitiveTestsApi.getTestResults(lastTestId);
      setSelectedTestResults(result as DetailedTestResult);
      setShowResultDetails(true);
      setIsLoading(false);
    } catch (error) {
      console.error("Не удалось загрузить результаты теста:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить результаты теста",
        variant: "destructive"
      });
      setIsLoading(false);
    }
  };

  return {
    testHistory,
    showResultDetails,
    setShowResultDetails,
    selectedTestResults,
    isLoading,
    getLastResult,
    viewTestDetails,
    checkTestCooldown,
    refreshHistory: fetchTestHistory
  };
};
