
import React from 'react';
import { useDashboardData } from "@/hooks/useDashboardData";
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
  ChevronRight
} from "lucide-react";

const Dashboard = () => {
  const { data, isLoading, error } = useDashboardData();

  if (isLoading) {
    return <div className="w-full h-80 flex items-center justify-center text-xl">Загрузка...</div>;
  }
  if (error) {
    return <div className="w-full h-80 flex items-center justify-center text-xl text-red-600">Ошибка загрузки данных</div>;
  }
  if (!data) {
    return <div className="w-full h-80 flex items-center justify-center text-xl">Нет данных</div>;
  }

  const { user, flightStats, crew, lastFatigue, testsStatus, medical } = data;

  // Проверим, что flightStats не undefined
  const hasFlightStats = !!flightStats && typeof flightStats.weeklyFlights !== 'undefined';

  // Проверим, что crew.members - это массив
  const crewMembers = Array.isArray(crew?.members) ? crew.members : [];

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
            {hasFlightStats ? (
              <div className="space-y-5">
                <div className="flex justify-between items-center">
                  <span className="text-base font-medium">Количество полетов за неделю</span>
                  <span className="text-xl font-bold">{flightStats.weeklyFlights}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-base font-medium">Налет часов за неделю</span>
                  <span className="text-xl font-bold">{flightStats.weeklyHours} ч</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-base font-medium">Количество полетов за месяц</span>
                  <span className="text-xl font-bold">{flightStats.monthlyFlights}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-base font-medium">Налет часов за месяц</span>
                  <span className="text-xl font-bold">{flightStats.monthlyHours} ч</span>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground">Нет данных о полетах</div>
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
            <CardDescription className="text-base">{crew?.crew_name || "Не найдено"}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {crewMembers.length > 0 ? (
                crewMembers.map((member, idx) => (
                  <div 
                    key={idx} 
                    className="flex justify-between items-center gap-4"
                  >
                    <div className="flex-grow truncate">
                      <span className="block text-base font-medium truncate">{member.name}</span>
                      <span className="block text-sm text-muted-foreground truncate">{member.position}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-muted-foreground">Нет данных о членах экипажа</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Flight Status (заглушка с примером, можно доработать при наличии данных) */}
        <Card className="hover-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-2xl flex items-center gap-3">
              <Clock className="h-6 w-6 text-primary" />
              Текущий полет
            </CardTitle>
            <CardDescription className="text-base">Информация о рейсе</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-center p-6 bg-secondary rounded-lg">
                <p className="font-bold text-2xl mb-2">--</p>
                <p className="text-lg mb-1">Нет данных о рейсе</p>
                <p className="text-base text-muted-foreground">--</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Status Checks */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        {/* Fatigue Analysis */}
        <Card className="hover-card bg-gradient-to-br from-primary/5 to-primary/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-2xl flex items-center gap-3">
              <Battery className="h-6 w-6 text-primary" />
              Усталость
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center py-2">
              <div className="mb-3 text-4xl font-bold">{lastFatigue?.fatigue_level || "--"}</div>
              <div className="text-base text-muted-foreground">Нейросеть: {lastFatigue?.neural_network_score ?? "--"}</div>
              <div className="text-sm text-muted-foreground">{lastFatigue?.analysis_date ?? "--"}</div>
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
            <div className="space-y-2">
              {Array.isArray(testsStatus) && testsStatus.length > 0 ? (
                testsStatus.map((t, idx) => (
                  <div className="flex items-center justify-between" key={idx}>
                    <div className="flex flex-col w-2/3">
                      <span className="text-base font-medium">{t.type}</span>
                      <span className="text-xs text-muted-foreground">{t.date}</span>
                    </div>
                    <span className="font-bold text-base">{t.score}</span>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-muted-foreground">Нет свежих тестов</div>
              )}
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
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-base">Дата осмотра</span>
                <span className="font-bold text-base">{medical?.check_date || "--"}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-base">Следующая проверка</span>
                <span className="font-bold text-base">{medical?.expiry_date || "--"}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-base">Доктор</span>
                <span className="font-bold text-base">{medical?.doctor_name || "--"}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-base">Статус</span>
                <span className="font-bold text-base">{medical?.status || "--"}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Example/заглушка: чек допуска (дополнить логику позже) */}
        <Card className="hover-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-2xl flex items-center gap-3">
              <PlaneTakeoff className="h-6 w-6 text-primary" />
              Допуск к полету
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center py-2">
              <Badge className="mb-2">{medical?.status === "passed" ? "Разрешен" : "Ограничения"}</Badge>
              <div className="text-sm text-muted-foreground">{medical?.notes ?? "--"}</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;

