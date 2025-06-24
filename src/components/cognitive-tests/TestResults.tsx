
import React from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BadgeCheck, AlertCircle, Clock, Timer } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { TestResult } from "@/types/cognitivetests";

interface TestResultsProps {
  result: TestResult;
  onClose?: () => void;
  onRetry?: () => void;
}

export const TestResults: React.FC<TestResultsProps> = ({
  result,
  onClose,
  onRetry
}) => {
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('ru-RU', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return dateString;
    }
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };
  
  const formatCooldownTime = (cooldownEndString?: string) => {
    if (!cooldownEndString) return null;
    
    const cooldownEnd = new Date(cooldownEndString);
    const now = new Date();
    
    if (cooldownEnd <= now) return null;
    
    const diffMs = cooldownEnd.getTime() - now.getTime();
    const diffMinutes = Math.ceil(diffMs / (1000 * 60));
    
    if (diffMinutes < 60) {
      return `${diffMinutes} мин.`;
    } else {
      const hours = Math.floor(diffMinutes / 60);
      const minutes = diffMinutes % 60;
      return `${hours} ч. ${minutes > 0 ? minutes + ' мин.' : ''}`;
    }
  };

  const getProgressColor = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getScoreStatus = (score: number) => {
    if (score >= 80) return 'Отлично';
    if (score >= 60) return 'Хорошо';
    if (score >= 40) return 'Удовлетворительно';
    return 'Требуется улучшение';
  };

  const getTestTypeName = (type: string) => {
    const types: Record<string, string> = {
      'attention': 'Тест внимания',
      'memory': 'Тест памяти',
      'reaction': 'Тест реакции',
      'cognitive': 'Когнитивный тест'
    };
    return types[type] || type;
  };

  const categorizeErrors = () => {
    if (!result.mistakes || result.mistakes.length === 0) return {};
    
    const categories: Record<string, any[]> = {};
    
    result.mistakes.forEach(mistake => {
      const questionType = getQuestionTypeFromText(mistake.question);
      if (!categories[questionType]) {
        categories[questionType] = [];
      }
      categories[questionType].push(mistake);
    });
    
    return categories;
  };
  
  const getQuestionTypeFromText = (questionText: string) => {
    if (questionText.includes('последовательность')) return 'Последовательности';
    if (questionText.includes('слова')) return 'Запоминание слов';
    if (questionText.includes('изображения')) return 'Запоминание изображений';
    if (questionText.includes('отличия')) return 'Поиск отличий';
    if (questionText.includes('треугольников')) return 'Подсчет фигур';
    if (questionText.includes('красные объекты')) return 'Выбор объектов';
    if (questionText.includes('цифра')) return 'Числовые последовательности';
    if (questionText.includes('лишнее')) return 'Вербальная логика';
    if (questionText.includes('решите пример')) return 'Математическая логика';
    if (questionText.includes('поворота')) return 'Пространственное мышление';
    
    return 'Другие вопросы';
  };

  const errorCategories = categorizeErrors();
  
  const cooldownTime = result.cooldown_end ? formatCooldownTime(result.cooldown_end) : null;
  const inCooldown = cooldownTime !== null;

  const categoryTypeRu: Record<string, string> = {
    "count": "Подсчет объектов/фигур",
    "pattern": "Поиск закономерности/паттерна",
    "logic": "Логика",
    "math": "Математика",
    "difference": "Поиск отличий",
    "select": "Выбор объектов",
    "sequence": "Последовательности",
    "words": "Запоминание слов",
    "images": "Запоминание изображений",
    "pairs": "Соотнесение пар",
    "matrix": "Матрицы/таблицы"
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <Card>
        <CardHeader className="pb-2">
          <CardDescription className="flex items-center text-sm text-muted-foreground">
            {formatDate(result.test_date)}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Результат:</span>
                <span className="text-lg font-bold">{result.score}%</span>
              </div>
              <Progress 
                value={result.score} 
                className={getProgressColor(result.score)}
              />
              <div className="text-sm text-right">{getScoreStatus(result.score)}</div>
            </div>
            
            <div className="grid grid-cols-2 gap-2 pt-2">
              <div className="flex items-center">
                <BadgeCheck className="h-4 w-4 mr-2 text-green-500" />
                <span className="text-sm">
                  {result.details.correct_answers} из {result.details.total_questions} правильно
                </span>
              </div>
              <div className="flex items-center">
                <Clock className="h-4 w-4 mr-2 text-blue-500" />
                <span className="text-sm">
                  Время: {formatTime(result.duration)}
                </span>
              </div>
            </div>
            
            {inCooldown && (
              <div className="flex items-center justify-between text-amber-500 py-1 px-2 bg-amber-50 rounded-md">
                <span className="flex items-center text-sm">
                  <Timer className="h-4 w-4 mr-1" />
                  Повторное прохождение доступно через:
                </span>
                <span className="text-sm font-medium">{cooldownTime}</span>
              </div>
            )}
            
            <Separator />
            
            {Object.keys(errorCategories).length > 0 ? (
              <Accordion type="single" collapsible className="w-full">
                {Object.entries(errorCategories).map(([category, mistakes], index) => (
                  <AccordionItem key={index} value={`item-${index}`}>
                    <AccordionTrigger className="text-sm">
                      <div className="flex items-center">
                        <AlertCircle className="h-4 w-4 mr-2 text-amber-500" />
                        {category} ({mistakes.length})
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <ul className="space-y-2 text-sm">
                        {mistakes.map((mistake, i) => (
                          <li key={i} className="border-l-2 border-amber-500 pl-2">
                            <p className="font-medium">{mistake.question}</p>
                            <p className="text-red-500">Ваш ответ: {mistake.user_answer}</p>
                            <p className="text-green-500">Правильный ответ: {mistake.correct_answer}</p>
                          </li>
                        ))}
                      </ul>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            ) : (
              <div className="flex items-center justify-center py-2">
                <BadgeCheck className="h-5 w-5 mr-2 text-green-500" />
                <span>Все ответы верны!</span>
              </div>
            )}
            
            {result.details.error_analysis && (
              <div className="mt-4">
                <h4 className="text-sm font-medium mb-2">Анализ по категориям вопросов:</h4>
                <div className="space-y-1">
                  {Object.entries(result.details.error_analysis).map(([type, count], i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span>{categoryTypeRu[type] || type}</span>
                      <span>{count} ошибок</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
        {onClose && (
          <CardFooter className="flex justify-end">
            <Button onClick={onClose}>
              Закрыть
            </Button>
          </CardFooter>
        )}
      </Card>
    </div>
  );
};
