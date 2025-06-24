
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Brain, ChevronRight } from "lucide-react";
import { Link } from 'react-router-dom';
import { useTestHistory } from "@/hooks/useTestHistory";

export const CognitiveTestsWidget = () => {
  const { getLastResult, isLoading } = useTestHistory();

  const tests = [
    { id: 'attention', name: 'Тест внимания' },
    { id: 'memory', name: 'Тест памяти' },
    { id: 'reaction', name: 'Тест реакции' },
    { id: 'cognitive', name: 'Когнитивный тест' }
  ];

  const getStatusDisplay = (status: string) => {
    switch (status) {
      case 'passed':
        return { text: 'Пройден', className: 'text-status-good' };
      case 'warning':
        return { text: 'Требуется повторный тест', className: 'text-status-warning' };
      case 'failed':
        return { text: 'Не пройден', className: 'text-status-danger' };
      default:
        return { text: 'Не пройден', className: 'text-muted-foreground' };
    }
  };

  const getStatusIndicator = (status: string) => {
    switch (status) {
      case 'passed':
        return 'status-good';
      case 'warning':
        return 'status-warning';
      case 'failed':
        return 'status-danger';
      default:
        return 'status-danger';
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
          {tests.map((test) => {
            const result = getLastResult(test.id);
            const statusDisplay = result ? getStatusDisplay(result.status) : getStatusDisplay('failed');
            const statusIndicator = result ? getStatusIndicator(result.status) : getStatusIndicator('failed');
            
            return (
              <div key={test.id} className="flex items-center justify-between">
                <div className="flex items-center">
                  <span className={`status-indicator ${statusIndicator}`}></span>
                  <span className="text-base">{test.name}</span>
                </div>
                <span className={`font-bold text-base ${statusDisplay.className}`}>
                  {statusDisplay.text}
                </span>
              </div>
            );
          })}
          
          <div className="flex justify-center pt-2">
            <Link to="/cognitive-tests">
              <Button variant="ghost" size="default" className="text-base">
                Пройти тесты
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
