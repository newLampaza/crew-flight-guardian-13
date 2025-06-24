import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalendarDays, Clock, Plane, Users, AlertTriangle, CheckCircle } from "lucide-react";
import { useDashboardCurrentFlight } from "@/hooks/useDashboardCurrentFlight";
import { useDashboardFlightStats } from "@/hooks/useDashboardFlightStats";
import { useDashboardCrew } from "@/hooks/useDashboardCrew";
import { CognitiveTestsWidget } from "@/components/dashboard/CognitiveTestsWidget";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { currentFlight, isLoading: flightLoading } = useDashboardCurrentFlight();
  const { flightStats, isLoading: statsLoading } = useDashboardFlightStats();
  const { crewData, isLoading: crewLoading } = useDashboardCrew();

  const handleStartTest = (testId: string) => {
    navigate(`/cognitive-tests?start=${testId}`);
  };

  const formatTime = (dateString: string | undefined) => {
    if (!dateString) return 'Неизвестно';
    try {
      const date = new Date(dateString);
      return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return 'Неизвестно';
    }
  };

  const getFlightStatus = (status: string | undefined) => {
    if (!status) return 'Неизвестен';
    
    const statuses: Record<string, string> = {
      'scheduled': 'Запланирован',
      'in_progress': 'В полете',
      'completed': 'Завершен',
      'cancelled': 'Отменен'
    };
    
    return statuses[status] || status;
  };

  const getCurrentFlightCard = () => {
    if (flightLoading) {
      return (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Текущий полет</CardTitle>
            <Plane className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="h-4 bg-muted rounded animate-pulse" />
              <div className="h-4 bg-muted rounded animate-pulse w-3/4" />
            </div>
          </CardContent>
        </Card>
      );
    }

    if (!currentFlight) {
      return (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Текущий полет</CardTitle>
            <Plane className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-center text-muted-foreground">
              Нет активных полетов
            </div>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Текущий полет</CardTitle>
          <Plane className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            <div className="text-2xl font-bold">{currentFlight.flight_number}</div>
            <p className="text-xs text-muted-foreground">
              {currentFlight.departure_airport} → {currentFlight.arrival_airport}
            </p>
            <div className="text-sm">
              <span className="text-muted-foreground">Статус: </span>
              <span className="font-medium">{getFlightStatus(currentFlight.status)}</span>
            </div>
            <div className="text-sm">
              <span className="text-muted-foreground">Время вылета: </span>
              <span className="font-medium">{formatTime(currentFlight.departure_time)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Добро пожаловать, {user?.first_name}</h1>
          <p className="text-muted-foreground">
            Здесь отображается ваша текущая статистика и предстоящие полеты
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {getCurrentFlightCard()}
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Статистика полетов</CardTitle>
            <Plane className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <div className="space-y-2">
                <div className="h-4 bg-muted rounded animate-pulse" />
                <div className="h-4 bg-muted rounded animate-pulse w-3/4" />
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-2xl font-bold">{flightStats?.total_flights || 0}</div>
                <p className="text-xs text-muted-foreground">
                  Всего полетов за месяц
                </p>
                <div className="text-sm">
                  <span className="text-muted-foreground">Часов налета: </span>
                  <span className="font-medium">{flightStats?.total_hours || 0}ч</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Экипаж</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {crewLoading ? (
              <div className="space-y-2">
                <div className="h-4 bg-muted rounded animate-pulse" />
                <div className="h-4 bg-muted rounded animate-pulse w-2/3" />
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-2xl font-bold">{crewData?.crew_size || 0}</div>
                <p className="text-xs text-muted-foreground">
                  Участников в экипаже
                </p>
                {crewData?.captain && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Командир: </span>
                    <span className="font-medium">{crewData.captain}</span>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="md:col-span-2 lg:col-span-1">
          <CognitiveTestsWidget onStartTest={handleStartTest} />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Предстоящие полеты</CardTitle>
            <CardDescription>Ваши запланированные рейсы</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="font-medium">SU-1234</p>
                  <p className="text-sm text-muted-foreground">Москва → Санкт-Петербург</p>
                </div>
                <div className="text-right">
                  <p className="text-sm">Завтра</p>
                  <p className="text-sm text-muted-foreground">08:30</p>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="font-medium">SU-5678</p>
                  <p className="text-sm text-muted-foreground">Санкт-Петербург → Екатеринбург</p>
                </div>
                <div className="text-right">
                  <p className="text-sm">28.06</p>
                  <p className="text-sm text-muted-foreground">14:15</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Быстрые действия</CardTitle>
            <CardDescription>Часто используемые функции</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button 
              variant="outline" 
              className="w-full justify-start" 
              onClick={() => navigate('/fatigue-analysis')}
            >
              <AlertTriangle className="mr-2 h-4 w-4" />
              Анализ усталости
            </Button>
            <Button 
              variant="outline" 
              className="w-full justify-start"
              onClick={() => navigate('/cognitive-tests')}
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              Когнитивные тесты
            </Button>
            <Button 
              variant="outline" 
              className="w-full justify-start"
              onClick={() => navigate('/schedule')}
            >
              <CalendarDays className="mr-2 h-4 w-4" />
              Расписание полетов
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
