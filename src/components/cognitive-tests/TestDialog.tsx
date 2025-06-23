
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TestProgress } from "./TestProgress";
import TestQuestion from "./TestQuestion";
import { TestResults } from "./TestResults";
import { TestResult, TestQuestion as TestQuestionType } from "@/types/cognitivetests";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

interface TestDialogProps {
  isOpen: boolean;
  testConfig: {
    id: string;
    name: string;
    description: string;
  } | undefined;
  testInProgress: boolean;
  testComplete: boolean;
  reviewingSkipped: boolean;
  currentTestSession: {
    timeLimit: number;
    questions: TestQuestionType[];
    currentQuestion: number;
    skippedQuestions: string[];
  } | null;
  testResults: TestResult | null;
  isLoading: boolean;
  onClose: () => void;
  onStart: () => void;
  onAnswer: (questionId: string, answer: string) => void;
  onSkip: () => void;
  onReviewSkipped: () => void;
  onFinishWithSkipped: () => void;
  onTimeUp: () => void;
}

export const TestDialog: React.FC<TestDialogProps> = ({
  isOpen,
  testConfig,
  testInProgress,
  testComplete,
  reviewingSkipped,
  currentTestSession,
  testResults,
  isLoading,
  onClose,
  onStart,
  onAnswer,
  onSkip,
  onReviewSkipped,
  onFinishWithSkipped,
  onTimeUp
}) => {
  const currentQuestion = currentTestSession 
    ? currentTestSession.questions[currentTestSession.currentQuestion]
    : null;

  const skippedCount = currentTestSession?.skippedQuestions.length || 0;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {testConfig?.name}
            {reviewingSkipped && (
              <span className="text-sm bg-orange-100 text-orange-800 px-2 py-1 rounded">
                Просмотр пропущенных
              </span>
            )}
          </DialogTitle>
          <DialogDescription>
            {testInProgress 
              ? reviewingSkipped 
                ? `Просмотр пропущенных вопросов (${skippedCount} осталось)`
                : "Выполнение теста..." 
              : testComplete 
                ? "Тест завершен" 
                : "Готовы начать тест?"}
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          {testInProgress && currentTestSession && (
            <div className="space-y-4">
              {!reviewingSkipped && (
                <TestProgress 
                  timeLimit={currentTestSession.timeLimit}
                  onTimeUp={onTimeUp}
                />
              )}
              
              {currentQuestion && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">
                      Вопрос {currentTestSession.currentQuestion + 1} из {currentTestSession.questions.length}
                      {skippedCount > 0 && (
                        <span className="ml-2 text-orange-600">
                          (Пропущено: {skippedCount})
                        </span>
                      )}
                    </span>
                    {!reviewingSkipped && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={onSkip}
                        disabled={isLoading}
                      >
                        Пропустить
                      </Button>
                    )}
                  </div>
                  
                  <TestQuestion
                    question={currentQuestion}
                    onAnswer={onAnswer}
                    disabled={isLoading}
                  />
                </div>
              )}
            </div>
          )}
          
          {testComplete && !testResults && currentTestSession && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  Тест завершен
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {skippedCount > 0 ? (
                  <div className="space-y-4">
                    <div className="flex items-start gap-3 p-4 bg-orange-50 rounded-lg">
                      <AlertTriangle className="h-5 w-5 text-orange-500 mt-0.5" />
                      <div>
                        <p className="font-medium text-orange-800">
                          Есть пропущенные вопросы
                        </p>
                        <p className="text-sm text-orange-600">
                          У вас {skippedCount} пропущенных вопросов. Вы можете вернуться к ним или завершить тест с текущими ответами.
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <Button onClick={onReviewSkipped} className="flex-1">
                        Ответить на пропущенные ({skippedCount})
                      </Button>
                      <Button 
                        variant="outline" 
                        onClick={onFinishWithSkipped} 
                        className="flex-1"
                      >
                        Завершить тест
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground">
                    Обработка результатов...
                  </p>
                )}
              </CardContent>
            </Card>
          )}
          
          {testComplete && testResults && (
            <TestResults
              result={testResults}
              onClose={onClose}
            />
          )}
          
          {!testInProgress && !testComplete && (
            <Card>
              <CardHeader>
                <CardTitle>О тесте</CardTitle>
                <CardDescription>{testConfig?.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Приготовьтесь к прохождению теста. Во время теста будьте внимательны и сосредоточены.
                  Рекомендуется находиться в тихом помещении без отвлекающих факторов.
                </p>
                <div className="p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-800">
                    💡 <strong>Подсказка:</strong> Если вы не уверены в ответе, можете пропустить вопрос и вернуться к нему в конце теста.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
        
        <DialogFooter>
          {!testInProgress && !testComplete && (
            <>
              <Button variant="outline" onClick={onClose} disabled={isLoading}>
                Отмена
              </Button>
              <Button onClick={onStart} disabled={isLoading}>
                {isLoading ? "Загрузка..." : "Начать тест"}
              </Button>
            </>
          )}
          
          {testInProgress && !reviewingSkipped && (
            <Button variant="outline" onClick={onClose} disabled={isLoading}>
              Отменить тест
            </Button>
          )}
          
          {testComplete && testResults && (
            <Button onClick={onClose} disabled={isLoading}>
              Закрыть
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
