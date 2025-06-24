
import React, { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { TestQuestion } from '@/types/cognitivetests';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

interface TestQuestionProps {
  question: TestQuestion;
  onAnswer: (questionId: string, answer: string) => void;
  disabled?: boolean;
}

const UNSPLASH_IMAGES = [
  "https://images.unsplash.com/photo-1518770660439-4636190af475?w=400&auto=format&fit=crop&q=60",
  "https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?w=400&auto=format&fit=crop&q=60",
  "https://images.unsplash.com/photo-1649972904349-6e44c42644a7?w=400&auto=format&fit=crop&q=60",
  "https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?w=400&auto=format&fit=crop&q=60",
];

const yandexFallbackUrl = "https://yastatic.net/s3/home/pages-blocks/illustrations/search/ru/search-image-1.png";

const getSafeImageUrl = (imgUrl: string) => {
  if (!imgUrl || imgUrl.includes('picsum.photos')) {
    const rand = Math.floor(Math.random() * UNSPLASH_IMAGES.length);
    return UNSPLASH_IMAGES[rand];
  }
  return imgUrl;
};

const EMOJIS: Record<string, string> = {
  "яблоко": "🍎",
  "банан": "🍌",
  "груша": "🍐",
  "апельсин": "🍊",
  "лимон": "🍋",
  "виноград": "🍇",
  "клубника": "🍓",
  "арбуз": "🍉",
  "персик": "🍑",
  "ананас": "🍍",
  "красный": "🟥",
  "синий": "🟦",
  "зеленый": "🟩",
  "желтый": "🟨",
  "фиолетовый": "🟪",
  "оранжевый": "🟧",
  "черный": "⬛",
  "белый": "⬜",
};

const TestQuestionComponent: React.FC<TestQuestionProps> = ({ question, onAnswer, disabled }) => {
  const [selectedOption, setSelectedOption] = useState<string>('');
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [showAnswer, setShowAnswer] = useState(true);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [imageFallbacks, setImageFallbacks] = useState<Record<string, boolean>>({});
  const [sequenceItems, setSequenceItems] = useState<string[]>([]);
  const [pairsSelection, setPairsSelection] = useState<Record<string, string>>({});
  const [startTime, setStartTime] = useState<number | null>(null);
  const [reactionTime, setReactionTime] = useState<number | null>(null);
  const [showStimulus, setShowStimulus] = useState(false);
  const [matrixAnswers, setMatrixAnswers] = useState<Record<string, string>>({});
  const [selectedCells, setSelectedCells] = useState<string[]>([]);
  const [waitingForStimulus, setWaitingForStimulus] = useState(false);

  useEffect(() => {
    setSelectedOption('');
    setSelectedOptions([]);
    setShowAnswer(question.delay ? false : true);
    setImageFallbacks({});
    setShowStimulus(false);
    setStartTime(null);
    setReactionTime(null);
    setSelectedCells([]);
    setWaitingForStimulus(false);

    if (question.type === 'sequence' && question.options) {
      setSequenceItems([...question.options]);
    }

    if (question.type === 'pairs') {
      setPairsSelection({});
    }

    if (question.type === 'matrix_selection') {
      setMatrixAnswers({});
    }

    if (question.delay) {
      setTimeLeft(question.delay);

      const timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev === null) return null;
          if (prev <= 1) {
            clearInterval(timer);
            setShowAnswer(true);
            return null;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }

    if (question.type === 'reaction') {
      setWaitingForStimulus(true);
      const delay = Math.random() * 3000 + 1000;
      const timer = setTimeout(() => {
        setShowStimulus(true);
        setStartTime(Date.now());
        setWaitingForStimulus(false);
      }, delay);

      return () => clearTimeout(timer);
    }
  }, [question]);

  const handleMultipleSelect = (option: string) => {
    setSelectedOptions(prev => {
      if (prev.includes(option)) {
        return prev.filter(item => item !== option);
      }
      return [...prev, option];
    });
  };

  const handleDragEnd = (result: any) => {
    if (!result.destination) return;

    const items = Array.from(sequenceItems);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    setSequenceItems(items);
  };

  const handlePairSelection = (option: string, answer: string) => {
    setPairsSelection((prev) => ({
      ...prev,
      [option]: answer
    }));
  };

  const handleCellClick = (rowIndex: number, colIndex: number) => {
    const cellId = `${rowIndex}-${colIndex}`;
    
    setSelectedCells(prev => {
      if (prev.includes(cellId)) {
        return prev.filter(id => id !== cellId);
      } else {
        return [...prev, cellId];
      }
    });
  };

  const handleReaction = () => {
    if (showStimulus && startTime) {
      const endTime = Date.now();
      const reactionTimeMs = endTime - startTime;
      setReactionTime(reactionTimeMs);
      onAnswer(question.id, 'good_reaction');
    } else if (waitingForStimulus || !showStimulus) {
      setReactionTime(-1);
      onAnswer(question.id, 'early');
    }
  };

  const handleSubmit = () => {
    if (question.multiple_select) {
      onAnswer(question.id, selectedOptions.join(','));
    } else if (question.type === 'sequence') {
      onAnswer(question.id, sequenceItems.join(','));
    } else if (question.type === 'pairs') {
      const pairs = Object.entries(pairsSelection).map(([option, answer]) => `${option}:${answer}`);
      onAnswer(question.id, pairs.join(','));
    } else if (question.type === 'matrix_selection') {
      onAnswer(question.id, selectedCells.join(','));
    } else {
      onAnswer(question.id, selectedOption);
    }
  };

  const handleImageError = (img: string) => {
    console.error(`Ошибка загрузки изображения: ${img}`);
    setImageFallbacks(prev => ({
      ...prev,
      [img]: true
    }));
  };

  const getImageSource = (img: string) => {
    if (imageFallbacks[img]) {
      return yandexFallbackUrl;
    }
    return getSafeImageUrl(img);
  };

  const getTextWithEmoji = (text: string) => {
    const emoji = EMOJIS[text.toLowerCase()];
    return emoji ? `${text} ${emoji}` : text;
  };

  const renderQuestionContent = () => {
    switch (question.type) {
      case 'difference':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 mb-4">
              {question.images?.map((img, index) => (
                <div key={index} className="border p-2 rounded">
                  <img 
                    src={getImageSource(img)} 
                    alt={`Изображение ${index + 1}`} 
                    className="w-full h-auto"
                    onError={() => handleImageError(img)}
                  />
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {question.options?.map((option, index) => (
                <Button
                  key={index}
                  variant={selectedOption === option ? "default" : "outline"}
                  className="justify-start h-auto py-2 text-wrap whitespace-normal"
                  onClick={() => setSelectedOption(option)}
                >
                  {option}
                </Button>
              ))}
            </div>
          </div>
        );

      case 'count':
        return (
          <div className="space-y-4">
            {question.grid && (
              <div className="mb-4 flex justify-center">
                <div className="inline-block border-2 border-gray-300 rounded p-2 bg-gray-50">
                  {question.grid.map((row, rowIndex) => (
                    <div key={rowIndex} className="flex">
                      {row.map((cell, cellIndex) => (
                        <div
                          key={`${rowIndex}-${cellIndex}`}
                          className="w-8 h-8 flex items-center justify-center text-lg font-mono border border-gray-200"
                        >
                          {cell}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {question.options?.map((option, index) => (
                <Button
                  key={index}
                  variant={selectedOption === option ? "default" : "outline"}
                  className="justify-center h-auto py-2"
                  onClick={() => setSelectedOption(option)}
                >
                  {option}
                </Button>
              ))}
            </div>
          </div>
        );

      case 'pattern':
        return (
          <div className="space-y-4">
            {question.stimulus && (
              <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                <p className="text-center mb-3 font-medium">Последовательность:</p>
                <div className="flex items-center justify-center gap-3 flex-wrap">
                  {Array.isArray(question.stimulus) && question.stimulus.map((item, index) => (
                    <div
                      key={index}
                      className="w-12 h-12 flex items-center justify-center text-xl font-bold bg-white border-2 border-primary rounded-lg"
                    >
                      {item}
                    </div>
                  ))}
                  <div className="w-12 h-12 flex items-center justify-center text-xl font-bold bg-primary text-primary-foreground rounded-lg">
                    ?
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {question.options?.map((option, index) => (
                <Button
                  key={index}
                  variant={selectedOption === option ? "default" : "outline"}
                  className="justify-center h-auto py-2 text-lg"
                  onClick={() => setSelectedOption(option)}
                >
                  {option}
                </Button>
              ))}
            </div>
          </div>
        );

      case 'logic':
      case 'math':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-2">
              {question.options?.map((option, index) => (
                <Button
                  key={index}
                  variant={selectedOption === option ? "default" : "outline"}
                  className="justify-start h-auto py-3 text-wrap whitespace-normal"
                  onClick={() => setSelectedOption(option)}
                >
                  {option}
                </Button>
              ))}
            </div>
          </div>
        );

      case 'select':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-2">
              {question.options?.map((option, index) => (
                <div className="flex items-center space-x-2" key={index}>
                  <Checkbox 
                    id={`option-${index}`}
                    checked={selectedOptions.includes(option)}
                    onCheckedChange={() => handleMultipleSelect(option)}
                  />
                  <Label htmlFor={`option-${index}`}>{getTextWithEmoji(option)}</Label>
                </div>
              ))}
            </div>
          </div>
        );

      case 'sequence':
        return (
          <div className="text-center py-4">
            {!showAnswer ? (
              <div className="flex flex-col items-center justify-center">
                <p className="text-xl font-bold mb-4">Запомните последовательность:</p>
                <div className="flex flex-wrap justify-center gap-2 mb-4">
                  {Array.isArray(question.stimulus) && question.stimulus.map((item, index) => (
                    <div key={index} className="p-3 border-2 border-primary rounded-md bg-primary/10 font-medium">
                      {item}
                    </div>
                  ))}
                </div>
                <p className="text-lg">Осталось {timeLeft} секунд</p>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <p className="text-lg mb-4">Восстановите правильную последовательность:</p>
                <DragDropContext onDragEnd={handleDragEnd}>
                  <Droppable droppableId="sequence" direction="horizontal">
                    {(provided) => (
                      <div 
                        className="flex flex-wrap justify-center gap-2 mb-4 p-4 min-h-16 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50"
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                      >
                        {sequenceItems.map((item, index) => (
                          <Draggable key={`item-${index}`} draggableId={`item-${index}`} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className={`p-3 border-2 rounded-md bg-white cursor-move font-medium transition-all
                                  ${snapshot.isDragging ? 'border-primary shadow-lg rotate-1 scale-105' : 'border-gray-300 hover:border-gray-400'}`}
                                style={{
                                  ...provided.draggableProps.style,
                                }}
                              >
                                {item}
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>
                <p className="text-sm text-muted-foreground">Перетаскивайте элементы, чтобы расположить их в правильном порядке</p>
              </div>
            )}
          </div>
        );

      case 'words':
        return (
          <div className="space-y-4">
            {!showAnswer ? (
              <div className="text-center py-8">
                <p className="text-xl font-bold mb-4">Запомните слова:</p>
                <div className="flex flex-wrap justify-center gap-2 mb-4">
                  {Array.isArray(question.stimulus) && question.stimulus.map((word, index) => (
                    <div key={index} className="p-3 border-2 border-primary rounded bg-primary/10 font-medium">
                      {word}
                    </div>
                  ))}
                </div>
                <p className="text-lg">Осталось {timeLeft} секунд</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {question.options?.map((option, index) => (
                  <Button
                    key={index}
                    variant={selectedOptions.includes(option) ? "default" : "outline"}
                    className="justify-start h-auto py-2"
                    onClick={() => handleMultipleSelect(option)}
                  >
                    {option}
                  </Button>
                ))}
              </div>
            )}
          </div>
        );

      case 'images':
        return (
          <div className="space-y-4">
            {!showAnswer ? (
              <div className="text-center py-4">
                <p className="text-xl font-bold mb-4">Запомните изображения:</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
                  {Array.isArray(question.stimulus) && question.stimulus.map((img, index) => (
                    <div key={index} className="border-2 border-primary p-2 rounded bg-primary/5">
                      <img 
                        src={getImageSource(img)} 
                        alt={`Изображение ${index + 1}`} 
                        className="w-full h-auto"
                        onError={() => handleImageError(img)}
                      />
                    </div>
                  ))}
                </div>
                <p className="text-lg">Осталось {timeLeft} секунд</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {question.options?.map((img, index) => (
                  <div 
                    key={index} 
                    className={`border-2 p-1 cursor-pointer rounded ${selectedOptions.includes(img) ? 'border-primary bg-primary/10' : 'border-gray-200 hover:border-gray-300'}`}
                    onClick={() => handleMultipleSelect(img)}
                  >
                    <img 
                      src={getImageSource(img)} 
                      alt={`Изображение ${index + 1}`} 
                      className="w-full h-auto"
                      onError={() => handleImageError(img)}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case 'pairs':
        return (
          <div className="space-y-4">
            {!showAnswer ? (
              <div className="text-center py-4">
                <p className="text-xl font-bold mb-4">Запомните соответствия:</p>
                <div className="grid grid-cols-1 gap-3 max-w-md mx-auto">
                  {question.options?.map((option, index) => {
                    const answer = question.answer_options?.[index];
                    return (
                      <div key={index} className="flex items-center justify-between border-2 border-primary p-3 rounded bg-primary/5">
                        <span className="font-medium">{option}</span>
                        <span className="text-primary text-xl">→</span>
                        <span className="font-medium">{answer}</span>
                      </div>
                    );
                  })}
                </div>
                <p className="text-lg mt-4">Осталось {timeLeft} секунд</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {question.options?.map((option, index) => (
                  <div key={index} className="flex flex-col sm:flex-row sm:items-center gap-2 border p-3 rounded">
                    <Label className="min-w-32 font-medium">{option}</Label>
                    <select
                      className="flex-1 border-2 border-gray-300 p-2 rounded-md"
                      value={pairsSelection[option] || ""}
                      onChange={(e) => handlePairSelection(option, e.target.value)}
                    >
                      <option value="">Выберите...</option>
                      {question.answer_options?.map((answer, i) => (
                        <option key={i} value={answer}>{answer}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case 'matrix':
        return (
          <div className="space-y-4">
            {!showAnswer ? (
              <div className="text-center py-4">
                <p className="text-xl font-bold mb-4">Запомните матрицу:</p>
                <div className="inline-block border-2 border-primary rounded overflow-hidden bg-white">
                  {question.matrix?.map((row, rowIndex) => (
                    <div key={rowIndex} className="flex">
                      {row.map((cell, cellIndex) => (
                        <div
                          key={`${rowIndex}-${cellIndex}`}
                          className="border border-gray-300 p-4 text-center min-w-12 font-medium bg-primary/5"
                        >
                          {cell}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
                <p className="text-lg mt-4">Осталось {timeLeft} секунд</p>
              </div>
            ) : (
              <>
                {question.question_text && (
                  <p className="text-lg">{question.question_text}</p>
                )}
                <div className="grid grid-cols-2 gap-2 mt-4">
                  {question.options?.map((option, index) => (
                    <Button
                      key={index}
                      variant={selectedOption === option ? "default" : "outline"}
                      className="justify-start h-auto py-2 text-wrap whitespace-normal"
                      onClick={() => setSelectedOption(option)}
                    >
                      {option}
                    </Button>
                  ))}
                </div>
              </>
            )}
          </div>
        );

      case 'reaction':
        return (
          <div className="space-y-4">
            <div className="flex flex-col items-center justify-center min-h-[300px]">
              {reactionTime === null ? (
                <>
                  <Button
                    className={`w-40 h-40 rounded-full text-xl font-bold transition-all transform ${
                      showStimulus 
                        ? 'bg-green-500 hover:bg-green-600 scale-110 animate-pulse' 
                        : 'bg-red-500 hover:bg-red-600'
                    }`}
                    onClick={handleReaction}
                  >
                    {showStimulus ? 'НАЖМИТЕ!' : 'Ждите зеленый...'}
                  </Button>
                  <p className="text-muted-foreground mt-6 text-center max-w-md">
                    {!showStimulus ? 
                      "Подождите, пока кнопка станет зеленой, затем нажмите как можно быстрее" : 
                      "Нажмите СЕЙЧАС!"
                    }
                  </p>
                </>
              ) : (
                <div className="text-center">
                  <div className="text-4xl font-bold mb-4">
                    {reactionTime === -1 ? 
                      '😤 Слишком рано!' : 
                      `⚡ ${reactionTime}мс`
                    }
                  </div>
                  <p className="text-lg text-muted-foreground">
                    {reactionTime === -1 ? 
                      "Вы нажали до того, как кнопка стала зеленой" :
                      reactionTime < 200 ? "Отличная реакция!" :
                      reactionTime < 300 ? "Хорошая реакция" :
                      reactionTime < 500 ? "Нормальная реакция" :
                      "Медленная реакция"
                    }
                  </p>
                </div>
              )}
            </div>
          </div>
        );

      case 'memory':
        return (
          <div className="space-y-4">
            {!showAnswer ? (
              <div className="text-center py-4">
                <p className="text-xl font-bold mb-4">Запомните последовательность:</p>
                <div className="flex justify-center gap-2 mb-4 flex-wrap">
                  {Array.isArray(question.stimulus) && question.stimulus.map((item, index) => (
                    <div 
                      key={index}
                      className="w-14 h-14 flex items-center justify-center text-2xl font-bold bg-primary text-primary-foreground rounded-lg border-2 border-primary"
                    >
                      {item}
                    </div>
                  ))}
                </div>
                <p className="text-lg mt-4">Осталось {timeLeft} секунд</p>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-lg text-center mb-4">Выберите правильную последовательность:</p>
                <div className="grid grid-cols-1 gap-3">
                  {question.options?.map((option, index) => (
                    <Button
                      key={index}
                      variant={selectedOption === option ? "default" : "outline"}
                      className="justify-start h-auto py-3 text-lg"
                      onClick={() => setSelectedOption(option)}
                    >
                      <div className="flex items-center space-x-2">
                        <span className="font-bold">{index + 1}.</span>
                        <span>{option}</span>
                      </div>
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>
        );

      case 'matrix_selection':
        return (
          <div className="space-y-4">
            <p className="text-lg mb-2 font-medium">{question.question_text}</p>
            
            <div className="flex justify-center">
              <div className="inline-block border-2 border-gray-300 rounded overflow-hidden bg-white">
                {question.grid?.map((row, rowIndex) => (
                  <div key={rowIndex} className="flex">
                    {row.map((cell, colIndex) => {
                      const cellId = `${rowIndex}-${colIndex}`;
                      const isSelected = selectedCells.includes(cellId);
                      
                      return (
                        <div
                          key={`${rowIndex}-${colIndex}`}
                          className={`border border-gray-300 p-4 text-center min-w-12 cursor-pointer transition-all font-medium
                            ${isSelected ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-gray-100'}`}
                          onClick={() => handleCellClick(rowIndex, colIndex)}
                        >
                          {cell}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
            
            <p className="text-sm text-muted-foreground text-center">
              Нажмите на элементы, чтобы выбрать их. Нажмите повторно, чтобы отменить выбор.
            </p>
          </div>
        );

      case 'cognitive':
        if (question.question.includes('математическая последовательность')) {
          return (
            <div className="space-y-4">
              <div className="p-6 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border">
                <p className="text-lg font-medium mb-4 text-center">Найдите следующее число в последовательности:</p>
                <div className="flex items-center justify-center gap-4 text-3xl font-bold flex-wrap">
                  {Array.isArray(question.stimulus) && question.stimulus.map((num, index) => (
                    <React.Fragment key={index}>
                      <span className="px-3 py-2 bg-white rounded-lg border-2 border-blue-200">{num}</span>
                      {index < question.stimulus.length - 1 && <span className="text-blue-500">→</span>}
                    </React.Fragment>
                  ))}
                  <span className="text-blue-500">→</span>
                  <span className="px-3 py-2 bg-primary text-primary-foreground rounded-lg border-2 border-primary text-2xl">?</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-6">
                {question.options?.map((option, index) => (
                  <Button
                    key={index}
                    variant={selectedOption === option ? "default" : "outline"}
                    className="text-xl py-4 font-bold"
                    onClick={() => setSelectedOption(option)}
                  >
                    {option}
                  </Button>
                ))}
              </div>
            </div>
          );
        }
        
        if (question.question.includes('визуальные аналогии')) {
          return (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-lg font-medium mb-3">Найдите закономерность и выберите подходящий вариант:</p>
                
                {question.image && (
                  <div className="mb-4">
                    <img 
                      src={getImageSource(question.image)} 
                      alt="Аналогия" 
                      className="max-w-full h-auto mx-auto"
                      onError={() => handleImageError(question.image || '')}
                    />
                  </div>
                )}
                
                <div className="text-xl font-bold text-center mt-2">
                  <span>? : ?</span>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mt-4">
                {question.images?.map((img, index) => (
                  <div 
                    key={index} 
                    className={`border-2 p-2 cursor-pointer rounded-md transition-all ${selectedOption === question.options?.[index] ? 'border-primary ring-2 ring-primary/30' : 'border-gray-200 hover:border-gray-300'}`}
                    onClick={() => setSelectedOption(question.options?.[index] || '')}
                  >
                    <img 
                      src={getImageSource(img)} 
                      alt={`Вариант ${index + 1}`} 
                      className="w-full h-auto"
                      onError={() => handleImageError(img)}
                    />
                    <p className="text-center mt-1">Вариант {index + 1}</p>
                  </div>
                ))}
              </div>
            </div>
          );
        }

        // Fallback for other cognitive types
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-2">
              {question.options?.map((option, index) => (
                <Button
                  key={index}
                  variant={selectedOption === option ? "default" : "outline"}
                  className="justify-start h-auto py-3 text-wrap whitespace-normal"
                  onClick={() => setSelectedOption(option)}
                >
                  {option}
                </Button>
              ))}
            </div>
          </div>
        );

      default:
        return (
          <div className="p-8 text-center bg-gray-50 rounded-lg">
            <p className="text-lg text-muted-foreground">Этот тип вопроса находится в разработке</p>
            <p className="text-sm text-muted-foreground mt-2">Тип: {question.type}</p>
          </div>
        );
    }
  };

  const getSubmitDisabled = () => {
    if (disabled) return true;
    if (timeLeft !== null) return true;
    
    switch (question.type) {
      case 'select':
      case 'words':
      case 'images':
        return selectedOptions.length === 0;
      case 'pairs':
        return question.options?.some(option => !pairsSelection[option]) || false;
      case 'sequence':
        return false;
      case 'matrix_selection':
        return selectedCells.length === 0;
      case 'reaction':
        return reactionTime === null;
      default:
        return !selectedOption;
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardContent className="pt-6">
        <h2 className="text-xl font-semibold mb-6">{question.question}</h2>
        
        {timeLeft !== null ? (
          renderQuestionContent()
        ) : (
          <>
            {renderQuestionContent()}
            
            {question.type !== 'reaction' && (
              <div className="mt-6 flex justify-end">
                <Button 
                  onClick={handleSubmit} 
                  disabled={getSubmitDisabled()}
                  className="px-8"
                >
                  Ответить
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default TestQuestionComponent;
