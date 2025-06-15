import React, { useState, useEffect } from 'react';
import { useAuth } from "@/context/AuthContext";
import AdminHome from './AdminHome';
import MedicalHome from './MedicalHome';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from 'react-router-dom';
import {
  PlaneTakeoff,
  Users,
  Clock,
  Brain,
  Stethoscope,
  Battery,
  AlertTriangle,
  Activity,
  ChevronRight,
  Calendar
} from "lucide-react";
import { useDashboardFlightStats } from "@/hooks/useDashboardFlightStats";
import { useDashboardCrew } from "@/hooks/useDashboardCrew";
import { useDashboardCurrentFlight } from "@/hooks/useDashboardCurrentFlight";
import { useFatigueAnalysis } from "@/hooks/useFatigueAnalysis";

const Dashboard = () => {
  const { user, isAdmin, isMedical, isPilot } = useAuth();
  
  // Получаем реальные данные с бэка
  const { data: flightStats, isLoading: isStatsLoading } = useDashboardFlightStats();
  const { data: crewData, isLoading: isCrewLoading } = useDashboardCrew();
  const { data: currentFlight, isLoading: isFlightLoading } = useDashboardCurrentFlight();
  
  // Получаем данные анализа усталости
  const { historyData, loadHistory } = useFatigueAnalysis();
  
  // Загружаем историю анализов при маунте компонента
  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  if (isAdmin()) {
    return <AdminHome />;
  }

  if (isMedical()) {
    return <MedicalHome />;
  }

  const formatFlightTime = (timeString) => {
    if (!timeString) return '';
    try {
      const date = new Date(timeString);
      return date.toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return timeString;
    }
  };

  // Вычисляем текущий уровень усталости на основе последнего анализа
  const getCurrentFatigueLevel = () => {
    if (historyData.length === 0) return 0;
    const latestAnalysis = historyData[0]; // historyData уже отсортирован по дате
    return Math.round((latestAnalysis.neural_network_score || 0) * 100);
  };

  const getFatigueStatus = (level) => {
    if (level >= 70) {
      return {
        label: 'Критический уровень',
        color: 'text-rose-500',
        bgColor: 'bg-rose-50 dark:bg-rose-500/10',
        borderColor: 'border-rose-200 dark:border-rose-800',
        badge: 'bg-rose-500',
        message: 'Требует немедленного внимания',
        icon: AlertTriangle
      };
    } else if (level >= 50) {
      return {
        label: 'Повышенный уровень усталости',
        color: 'text-amber-500',
        bgColor: 'bg-amber-50 dark:bg-amber-500/10',
        borderColor: 'border-amber-200 dark:border-amber-800',
        badge: 'bg-amber-500',
        message: 'Рекомендуется дополнительный отдых',
        icon: AlertTriangle
      };
    } else {
      return {
        label: 'Нормальный уровень',
        color: 'text-emerald-500',
        bgColor: 'bg-emerald-50 dark:bg-emerald-500/10',
        borderColor: 'border-emerald-200 dark:border-emerald-800',
        badge: 'bg-emerald-500',
        message: 'В пределах нормы',
        icon: Battery
      };
    }
  };

  const currentFatigueLevel = getCurrentFatigueLevel();
  const fatigueStatus = getFatigueStatus(currentFatigueLevel);
  const StatusIcon = fatigueStatus.icon;

  return (
    <div className="space-y-8 animate-fade-in max-w-7xl mx-auto">
      <div className="mb-8">
        <Card className="hover-card bg-gradient-to-br from-sidebar-primary/10 to-sidebar/5">
          <CardContent className="p-8">
            <div className="flex flex-col md:flex-row items-center gap-8">
              <Avatar className="h-28 w-28 border-4 border-background shadow-lg">
                <AvatarImage 
                  src={user?.avatarUrl} 
                  alt={user?.name}
                  className="object-cover"
                />
                <AvatarFallback className="text-3xl bg-primary/10 text-primary">
                  {user?.name?.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-3 text-center md:text-left flex-grow">
                <h1 className="text-4xl font-bold tracking-tight leading-tight">
                  Добро пожаловать, {user?.name}
                </h1>
                <div className="flex flex-col md:flex-row gap-4 md:gap-8 text-muted-foreground text-lg">
                  <div className="flex items-center justify-center md:justify-start gap-2">
                    <PlaneTakeoff className="h-5 w-5" />
                    <span>{user?.position}</span>
                  </div>
                  <div className="flex items-center justify-center md:justify-start gap-2">
                    <Users className="h-5 w-5" />
                    <span>{user?.role}</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    
      {/* Statistics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {/* Flight Statistics */}
        <Card className="hover-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-2xl flex items-center gap-3">
              <PlaneTakeoff className="h-6 w-6 text-primary" />
              Статистика полетов
            </CardTitle>
            <CardDescription className="text-base">Текущая неделя и месяц</CardDescription>
          </CardHeader>
          <CardContent>
            {isStatsLoading ? (
              <div className="text-center text-muted-foreground">Загрузка...</div>
            ) : (
              <div className="space-y-5">
                <div className="flex justify-between items-center">
                  <span className="text-base font-medium">Количество полетов за неделю</span>
                  <span className="text-xl font-bold">{flightStats?.weeklyFlights ?? "—"}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-base font-medium">Налет часов за неделю</span>
                  <span className="text-xl font-bold">{flightStats?.weeklyHours ?? "—"} ч</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-base font-medium">Количество полетов за месяц</span>
                  <span className="text-xl font-bold">{flightStats?.monthlyFlights ?? "—"}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-base font-medium">Налет часов за месяц</span>
                  <span className="text-xl font-bold">{flightStats?.monthlyHours ?? "—"} ч</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Current Crew */}
        <Card className="hover-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-2xl flex items-center gap-3">
              <Users className="h-6 w-6 text-primary" />
              Текущий экипаж
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isCrewLoading ? (
              <div className="text-center text-muted-foreground">Загрузка...</div>
            ) : (
              <div className="space-y-4">
                {crewData && Array.isArray(crewData) && crewData.map((member: any) => (
                  <div 
                    key={member.id} 
                    className="flex justify-between items-center gap-4"
                  >
                    <div className="flex-grow truncate">
                      <span className="block text-base font-medium truncate">{member.name}</span>
                      <span className="block text-sm text-muted-foreground truncate">{member.position}</span>
                    </div>
                    <Badge className="ml-4">{member.role}</Badge>
                  </div>
                ))}
                {(!crewData || !Array.isArray(crewData) || crewData.length === 0) && (
                  <div className="text-muted-foreground text-center text-base">Нет данных по экипажу</div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Flight Status */}
        <Card className="hover-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-2xl flex items-center gap-3">
              {currentFlight?.isActive ? (
                <Clock className="h-6 w-6 text-green-500" />
              ) : (
                <Calendar className="h-6 w-6 text-blue-500" />
              )}
              {currentFlight?.isActive ? 'Текущий полет' : 'Следующий рейс'}
            </CardTitle>
            <CardDescription className="text-base">
              {currentFlight?.isActive ? 'Информация о рейсе' : 'Запланированный рейс'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isFlightLoading ? (
              <div className="text-center text-muted-foreground">Загрузка...</div>
            ) : currentFlight?.flight_number ? (
              <div className="space-y-4">
                <div className="text-center p-6 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center justify-center gap-3 mb-3">
                    <p className="font-bold text-2xl text-blue-900 dark:text-blue-100">{currentFlight.flight_number}</p>
                    {currentFlight.isActive ? (
                      <Badge className="bg-green-500 hover:bg-green-600 text-white border-0 shadow-md">
                        Активный
                      </Badge>
                    ) : (
                      <Badge className="bg-blue-500 hover:bg-blue-600 text-white border-0 shadow-md px-3 py-1">
                        Запланирован
                      </Badge>
                    )}
                  </div>
                  <p className="text-lg mb-3 text-blue-800 dark:text-blue-200 font-medium">{currentFlight.route}</p>
                  
                  {currentFlight.isActive ? (
                    <div className="space-y-2">
                      <p className="text-base text-blue-700 dark:text-blue-300">
                        Отправление: {formatFlightTime(currentFlight.departure_time)}
                      </p>
                      {currentFlight.arrival_time && (
                        <p className="text-base text-blue-700 dark:text-blue-300">
                          Прибытие: {formatFlightTime(currentFlight.arrival_time)}
                        </p>
                      )}
                      <p className="text-base text-blue-700 dark:text-blue-300">
                        Продолжительность: {currentFlight.duration} мин
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-base text-blue-700 dark:text-blue-300">
                        Отправление: {formatFlightTime(currentFlight.departure_time)}
                      </p>
                      {currentFlight.arrival_time && (
                        <p className="text-base text-blue-700 dark:text-blue-300">
                          Прибытие: {formatFlightTime(currentFlight.arrival_time)}
                        </p>
                      )}
                      <p className="text-base text-blue-700 dark:text-blue-300">
                        Продолжительность: {currentFlight.duration} мин
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-muted-foreground text-center text-base">Нет запланированных рейсов</div>
            )}
          </CardContent>
        </Card>
      </div>
      
      {/* Status Checks */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        {/* Flight Permission Status */}
        <Card className="hover-card bg-gradient-to-br from-primary/5 to-primary/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-2xl flex items-center gap-3">
              <PlaneTakeoff className="h-6 w-6 text-primary" />
              Допуск к полету
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center py-2">
              <div className="relative w-32 h-32 mb-4">
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke="currentColor"
                    strokeWidth="16"
                    fill="none"
                    className="text-muted/20"
                  />
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke="currentColor"
                    strokeWidth="16"
                    fill="none"
                    strokeDasharray={351.8583}
                    strokeDashoffset={351.8583 - (351.8583 * 70) / 100}
                    className="text-amber-500 transition-all duration-1000"
                  />
                </svg>
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
                  <span className="text-3xl font-bold">70%</span>
                  <span className="text-xs block text-muted-foreground">Готовность</span>
                </div>
              </div>

              <Badge className="bg-amber-500 text-white mb-3 py-1 px-3 text-sm">
                Условный допуск
              </Badge>

              <div className="w-full bg-amber-50 dark:bg-amber-500/10 p-3 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium">Требуются дополнительные проверки</p>
                    <p className="text-muted-foreground">Пройдите повторный тест памяти и когнитивной гибкости</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Cognitive Tests */}
        <Card className="hover-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-2xl flex items-center gap-3">
              <Brain className="h-6 w-6 text-primary" />
              Когнитивные тесты
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <span className="status-indicator status-good"></span>
                  <span className="text-base">Тест внимания</span>
                </div>
                <span className="font-bold text-status-good text-base">Пройден</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <span className="status-indicator status-good"></span>
                  <span className="text-base">Тест реакции</span>
                </div>
                <span className="font-bold text-status-good text-base">Пройден</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <span className="status-indicator status-warning"></span>
                  <span className="text-base">Тест памяти</span>
                </div>
                <span className="text-status-warning text-base font-bold text-right">Требуется повторный тест</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <span className="status-indicator status-danger"></span>
                  <span className="text-base">Тест когнитивной гибкости</span>
                </div>
                <span className="font-bold text-status-danger text-base text-right">Не пройден</span>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Medical Check */}
        <Card className="hover-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-2xl flex items-center gap-3">
              <Stethoscope className="h-6 w-6 text-primary" />
              Медицинский контроль
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <span className="status-indicator status-good"></span>
                  <span className="text-base">Допуск к полетам</span>
                </div>
                <span className="font-bold text-status-good text-base">Разрешен</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <span className="status-indicator status-good"></span>
                  <span className="text-base">Дата медосмотра</span>
                </div>
                <span className="font-bold text-base">10.04.2025</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <span className="status-indicator status-good"></span>
                  <span className="text-base">Следующий осмотр</span>
                </div>
                <span className="font-bold text-base">10.10.2025</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <span className="status-indicator status-good"></span>
                  <span className="text-base">Врач</span>
                </div>
                <span className="font-bold text-base">Петров А.И.</span>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Updated Fatigue Analysis with Real Data */}
        <Card className="hover-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-2xl flex items-center gap-3">
              <Battery className="h-6 w-6 text-primary" />
              Анализ усталости
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-5">
              <div className="flex flex-col items-center">
                <div className="mb-3 text-6xl font-bold text-muted-foreground">
                  {currentFatigueLevel > 0 ? `${currentFatigueLevel}%` : '—'}
                </div>
                <div className="text-base text-muted-foreground">
                  {currentFatigueLevel > 0 ? fatigueStatus.label : 'Нет данных'}
                </div>
              </div>
              
              {currentFatigueLevel >= 50 && (
                <div className={`${fatigueStatus.bgColor} p-4 rounded-lg border ${fatigueStatus.borderColor}`}>
                  <div className="flex items-start gap-3">
                    <StatusIcon className={`h-6 w-6 ${fatigueStatus.color} mt-0.5`} />
                    <div>
                      <p className="text-base font-medium">{fatigueStatus.label}</p>
                      <p className="text-sm text-muted-foreground">{fatigueStatus.message}</p>
                    </div>
                  </div>
                </div>
              )}
              
              {historyData.length >= 2 && (
                <div className="flex justify-between items-center">
                  <div className="flex items-center w-2/3">
                    <Activity className="h-5 w-5 text-primary mr-2" />
                    <span className="text-base truncate">Динамика за неделю</span>
                  </div>
                  <div className="flex items-center w-1/3 justify-end">
                    {(() => {
                      const latest = Math.round((historyData[0].neural_network_score || 0) * 100);
                      const previous = Math.round((historyData[1].neural_network_score || 0) * 100);
                      const change = latest - previous;
                      const isIncrease = change > 0;
                      return (
                        <>
                          <span className={`mr-2 text-base ${isIncrease ? 'text-rose-500' : 'text-emerald-500'}`}>
                            {isIncrease ? '+' : ''}{change}%
                          </span>
                          <div className="w-20 h-2 bg-secondary rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${isIncrease ? 'bg-rose-500' : 'bg-emerald-500'}`} 
                              style={{ width: `${Math.min(Math.abs(change) * 10, 100)}%` }}
                            ></div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              )}
              
              <div className="flex justify-center">
                <Link to="/fatigue-analysis">
                  <Button variant="ghost" size="default" className="text-base">
                    Подробный анализ
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
