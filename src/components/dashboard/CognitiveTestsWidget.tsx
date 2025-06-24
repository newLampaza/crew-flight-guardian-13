
import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Brain, Clock, CheckCircle, AlertTriangle, Timer } from "lucide-react";
import { cognitiveTestsApi } from "@/api/cognitiveTestsApi";
import { TestHistory } from "@/types/cognitivetests";
import { useAuth } from "@/context/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";

interface CognitiveTestsWidgetProps {
  onStartTest?: (testId: string) => void;
}

const testConfig = [
  {
    id: "attention",
    name: "Тест внимания",
    description: "Концентрация и внимание к деталям"
  },
  {
    id: "memory", 
    name: "Тест памяти",
    description: "Кратковременная память и запоминание"
  },
  {
    id: "reaction",
    name: "Тест реакции", 
    description: "Скорость реакции на стимулы"
  },
  {
    id: "cognitive",
    name: "Когнитивный тест",
    description: "Логическое мышление и обработка информации"
  }
];

export const CognitiveTestsWidget: React.FC<CognitiveTestsWidgetProps> = ({ onStartTest }) => {
  const [testHistory, setTestHistory] = useState<TestHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (isAuthenticated) {
      fetchTestHistory();
    }
  }, [isAuthenticated]);

  const fetchTestHistory = async () => {
    try {
      const history = await cognitiveTestsApi.getTestHistory();
      setTestHistory(Array.isArray(history) ? history : []);
    } catch (error) {
      console.error("Ошибка загрузки истории тестов:", error);
      setTestHistory([]);
    } finally {
      setIsLoading(false);
    }
  };

  const getLastTestResult = (testType: string) => {
    if (!testHistory || testHistory.length === 0) return null;
    
    const results = testHistory.filter(test => test.test_type === testType);
    if (results.length === 0) return null;
    
    results.sort((a, b) => new Date(b.test_date).getTime() - new Date(a.test_date).getTime());
    return results[0];
  };

  const getStatusBadge = (testType: string) => {
    const result = getLastTestResult(testType);
    if (!result) return null;

    // Проверяем cooldown
    if (result.cooldown_end) {
      const cooldownEnd = new Date(result.cooldown_end);
      if (cooldownEnd > new Date()) {
        const diffMinutes = Math.ceil((cooldownEnd.getTime() - new Date().getTime()) / (1000 * 60));
        return (
          <Badge variant="secondary" className="text-xs">
            <Timer className="h-3 w-3 mr-1" />
            {diffMinutes} мин
          </Badge>
        );
      }
    }

    if (result.score >= 85) {
      return (
        <Badge variant="default" className="bg-green-500 text-xs">
          <CheckCircle className="h-3 w-3 mr-1" />
          {result.score}%
        </Badge>
      );
    } else if (result.score >= 70) {
      return (
        <Badge variant="secondary" className="bg-yellow-500 text-xs">
          <AlertTriangle className="h-3 w-3 mr-1" />
          {result.score}%
        </Badge>
      );
    } else {
      return (
        <Badge variant="destructive" className="text-xs">
          <AlertTriangle className="h-3 w-3 mr-1" />
          {result.score}%
        </Badge>
      );
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('ru-RU', { 
        day: '2-digit', 
        month: '2-digit'
      });
    } catch (e) {
      return '';
    }
  };

  const isTestAvailable = (testType: string) => {
    const result = getLastTestResult(testType);
    if (!result || !result.cooldown_end) return true;
    
    const cooldownEnd = new Date(result.cooldown_end);
    return cooldownEnd <= new Date();
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Когнитивные тесты
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="space-y-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-32" />
              </div>
              <Skeleton className="h-6 w-12" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!isAuthenticated) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Когнитивные тесты
          </CardTitle>
          <CardDescription>
            Войдите в систему для доступа к тестам
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5" />
          Когнитивные тесты
        </CardTitle>
        <CardDescription>
          Оценка психофизиологического состояния
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {testConfig.map(test => {
          const lastResult = getLastTestResult(test.id);
          const available = isTestAvailable(test.id);
          
          return (
            <div key={test.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-medium text-sm">{test.name}</h4>
                  {getStatusBadge(test.id)}
                </div>
                <p className="text-xs text-muted-foreground">{test.description}</p>
                {lastResult && (
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>Последний: {formatDate(lastResult.test_date)}</span>
                  </div>
                )}
              </div>
              <Button 
                size="sm" 
                variant={available ? "outline" : "secondary"}
                disabled={!available}
                onClick={() => onStartTest?.(test.id)}
                className="ml-2"
              >
                {available ? "Пройти" : "Ожидание"}
              </Button>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};
