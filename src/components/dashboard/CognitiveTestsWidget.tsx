
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Brain, Clock } from "lucide-react";
import { useTestHistory } from "@/hooks/useTestHistory";
import { Button } from "@/components/ui/button";
import { Link } from 'react-router-dom';

export const CognitiveTestsWidget = () => {
  const { getLastResult, isLoading, checkTestCooldown } = useTestHistory();

  const testTypes = [
    { id: 'attention', name: 'Тест внимания' },
    { id: 'reaction', name: 'Тест реакции' },
    { id: 'memory', name: 'Тест памяти' },
    { id: 'cognitive', name: 'Тест когнитивной гибкости' }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'passed': return 'text-green-500';
      case 'warning': return 'text-amber-500';
      case 'failed': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  const getStatusText = (testType: string) => {
    const result = getLastResult(testType);
    if (!result) return 'Не пройден';
    
    if (result.inCooldown) {
      return 'В перезарядке';
    }
    
    switch (result.status) {
      case 'passed': return 'Пройден';
      case 'warning': return 'Требуется повторный тест';
      case 'failed': return 'Не пройден';
      default: return 'Не пройден';
    }
  };

  const getStatusIndicator = (testType: string) => {
    const result = getLastResult(testType);
    if (!result) return 'status-danger';
    
    if (result.inCooldown) {
      return 'status-warning';
    }
    
    switch (result.status) {
      case 'passed': return 'status-good';
      case 'warning': return 'status-warning';
      case 'failed': return 'status-danger';
      default: return 'status-danger';
    }
  };

  const handleTestStart = async (testType: string) => {
    const inCooldown = await checkTestCooldown(testType);
    if (!inCooldown) {
      // Перенаправляем на страницу тестов с параметром автозапуска
      window.location.href = `/cognitive-tests?start=${testType}`;
    }
  };

  if (isLoading) {
    return (
      <Card className="hover-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-2xl flex items-center gap-3">
            <Brain className="h-6 w-6 text-primary" />
            Когнитивные тесты
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground">Загрузка...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="hover-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-2xl flex items-center gap-3">
          <Brain className="h-6 w-6 text-primary" />
          Когнитивные тесты
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {testTypes.map((test) => {
            const result = getLastResult(test.id);
            return (
              <div key={test.id} className="flex items-center justify-between">
                <div className="flex items-center flex-1">
                  <span className={`status-indicator ${getStatusIndicator(test.id)}`}></span>
                  <span className="text-base">{test.name}</span>
                  {result?.inCooldown && (
                    <Clock className="h-4 w-4 ml-2 text-amber-500" />
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`font-bold text-base ${getStatusColor(result?.status || 'failed')}`}>
                    {getStatusText(test.id)}
                  </span>
                  {result?.score && (
                    <span className="text-sm text-muted-foreground">
                      ({result.score}%)
                    </span>
                  )}
                </div>
              </div>
            );
          })}
          
          <div className="pt-4 border-t">
            <div className="flex gap-2">
              <Link to="/cognitive-tests" className="flex-1">
                <Button variant="outline" className="w-full">
                  Все тесты
                </Button>
              </Link>
              <Button 
                onClick={() => handleTestStart('attention')} 
                className="flex-1"
                disabled={isLoading}
              >
                Начать тест
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
