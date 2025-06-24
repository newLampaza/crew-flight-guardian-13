
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Brain } from "lucide-react";
import { useTestHistory } from "@/hooks/useTestHistory";
import { Button } from "@/components/ui/button";
import { Link } from 'react-router-dom';

export const CognitiveTestsWidget = () => {
  const { getLastResult, isLoading } = useTestHistory();

  const testTypes = [
    { id: 'attention', name: 'Тест внимания' },
    { id: 'reaction', name: 'Тест реакции' },
    { id: 'memory', name: 'Тест памяти' },
    { id: 'cognitive', name: 'Тест когнитивной гибкости' }
  ];

  const getTestStatus = (testType: string) => {
    const result = getLastResult(testType);
    if (!result) return { status: 'Не пройден', passed: false };
    
    if (result.inCooldown) {
      return { status: 'Не пройден', passed: false };
    }
    
    return result.status === 'passed' 
      ? { status: 'Пройден', passed: true }
      : { status: 'Не пройден', passed: false };
  };

  const getStatusIndicator = (passed: boolean) => {
    return passed ? 'status-good' : 'status-danger';
  };

  const getStatusColor = (passed: boolean) => {
    return passed ? 'text-green-500' : 'text-red-500';
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
            const testStatus = getTestStatus(test.id);
            return (
              <div key={test.id} className="flex items-center justify-between">
                <div className="flex items-center flex-1">
                  <span className={`status-indicator ${getStatusIndicator(testStatus.passed)}`}></span>
                  <span className="text-base">{test.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`font-bold text-base ${getStatusColor(testStatus.passed)}`}>
                    {testStatus.status}
                  </span>
                </div>
              </div>
            );
          })}
          
          <div className="pt-4 border-t">
            <Link to="/cognitive-tests" className="w-full">
              <Button variant="outline" className="w-full">
                Все тесты
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
