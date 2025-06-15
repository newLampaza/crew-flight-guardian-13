
import { useState, useMemo, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import {
  format,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
  endOfMonth,
  isSameDay,
  isSameMonth,
  startOfMonth,
  differenceInCalendarDays
} from "date-fns";
import { ru } from "date-fns/locale";
import {
  Calendar as CalendarIcon,
  ArrowLeft,
  ArrowRight,
  List,
  LayoutList,
  PlaneTakeoff,
  PlaneLanding,
  MapPin,
  Clock
} from "lucide-react";
import "../components/ui/schedule-view.css";
import { useFlights, FlightApi } from "@/hooks/useFlights";
import { useToast } from "@/hooks/use-toast";

interface Airport {
  airport: string;
  time: string;
  terminal: string;
}

interface Flight {
  id: number | string;
  flightNumber: string;
  departure: Airport;
  arrival: Airport;
  duration: string;
  aircraft: string;
  status: "active" | "upcoming" | "completed" | string;
  conditions?: string;
  crew?: string;
}

const getStatus = (flight: FlightApi): Flight["status"] => {
  const now = new Date();
  const dep = new Date(flight.departure_time);
  const arr = new Date(flight.arrival_time);
  if (dep <= now && arr > now) return "active";
  if (dep > now) return "upcoming";
  if (arr < now) return "completed";
  return "";
};

const getDurationString = (start: string, end: string): string => {
  const d1 = new Date(start); const d2 = new Date(end);
  const totalMin = Math.floor((d2.getTime() - d1.getTime()) / 60000);
  const hr = Math.floor(totalMin / 60);
  const min = totalMin % 60;
  return `${hr > 0 ? `${hr}ч ` : ""}${min}м`;
};

const prepareFlights = (flights: FlightApi[] | undefined): Flight[] => {
  if (!flights || !Array.isArray(flights)) {
    return [];
  }
  return flights.map(f => ({
    id: f.flight_id,
    flightNumber: f.flight_id && f.flight_id.toString().startsWith("SU")
      ? f.flight_id.toString() : (f.crew_name ? `SU${String(f.flight_id).padStart(4, "0")}` : String(f.flight_id)),
    departure: {
      airport: `${f.from_city} (${f.from_code})`,
      time: f.departure_time,
      terminal: "-", // Можно доработать, если появятся терминалы в API
    },
    arrival: {
      airport: `${f.to_city} (${f.to_code})`,
      time: f.arrival_time,
      terminal: "-",
    },
    duration: getDurationString(f.departure_time, f.arrival_time),
    aircraft: f.aircraft,
    status: getStatus(f),
    conditions: f.conditions,
    crew: f.crew_name
  }));
};

const formatDateShort = (dateString: string) => {
  try {
    const date = new Date(dateString);
    return date.toLocaleString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (error) {
    return dateString;
  }
};

const formatWeekday = (date: Date) => {
  return format(date, 'EEEE', { locale: ru });
};

const formatDayMonth = (date: Date) => {
  return format(date, 'd MMMM', { locale: ru });
};

const FlightCard = ({ flight }: { flight: Flight }) => {
  return (
    <div className={`flight-item concise`}>
      <div className="flex justify-between items-center">
        <div className="flight-number">{flight.flightNumber}</div>
        <Badge
          variant={
            flight.status === "active" ? "default" :
            flight.status === "upcoming" ? "secondary" :
            "outline"
          }
          className="text-xs"
        >
          {flight.status === "active" ? "В полёте" :
           flight.status === "upcoming" ? "Планируется" :
           "Выполнен"}
        </Badge>
      </div>
      <div className="flight-time mt-1">{formatDateShort(flight.departure.time)} → {formatDateShort(flight.arrival.time)}</div>
      <div className="flight-route text-muted-foreground">
        {flight.departure.airport} → {flight.arrival.airport}
      </div>
    </div>
  );
};

type ViewMode = "week" | "month";

const SchedulePage = () => {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [showCalendar, setShowCalendar] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const { data, isLoading, error } = useFlights();
  const { toast } = useToast();

  useEffect(() => {
    if (error) {
      toast({ title: "Ошибка загрузки расписания", description: "Не удалось получить расписание рейсов.", variant: "destructive" });
    }
  }, [error, toast]);

  const allFlights = useMemo(() => prepareFlights(data), [data]);

  // Cчитаем неделю для предстоящих рейсов с currentDate до конца недели
  const fullWeekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });

  // only days from currentDate to weekEnd (инклюзивно)
  const getUpcomingWeekDays = () => {
    const days: Date[] = [];
    let d = new Date(currentDate);
    d.setHours(0,0,0,0);
    const last = new Date(weekEnd);
    last.setHours(0,0,0,0);
    while (d <= last) {
      days.push(new Date(d));
      d.setDate(d.getDate() + 1);
    }
    return days;
  };

  // группируем по дню (для недели/месяца)
  const groupFlightsByDay = (flights: Flight[], days: Date[]) => {
    return days.map(day => {
      const flightsForDay = flights.filter(f =>
        isSameDay(new Date(f.departure.time), day)
      );
      return { date: day, flights: flightsForDay };
    });
  };

  // MONTH view: только дни выбранного месяца, где есть рейсы
  const getMonthGroupedFlights = (flights: Flight[], date: Date) => {
    const start = startOfMonth(date);
    const end = endOfMonth(date);
    // Считаем дни месяца, в которых есть хотя бы один рейс
    const daysWithFlights: Date[] = [];
    let d = new Date(start);
    d.setHours(0,0,0,0);
    const last = new Date(end);
    last.setHours(0,0,0,0);
    while (d <= last) {
      const hasFlights = flights.some(f =>
        isSameDay(new Date(f.departure.time), d)
      );
      if (hasFlights) daysWithFlights.push(new Date(d));
      d.setDate(d.getDate() + 1);
    }
    return groupFlightsByDay(flights, daysWithFlights);
  };

  const flightsByStatus = useMemo(() => {
    const upcoming: Flight[] = [];
    const past: Flight[] = [];
    for (const f of allFlights) {
      if (f.status === "completed") past.push(f);
      else if (f.status === "active" || f.status === "upcoming") upcoming.push(f);
    }
    return { upcoming, past };
  }, [allFlights]);

  // --- WEEK view: только с currentDate до конца недели
  const weekDays = useMemo(() =>
    getUpcomingWeekDays(), [currentDate, weekEnd]
  );

  // --- MONTH view: только дни месяца, где есть рейсы
  const monthDays = useMemo(
    () => {
      return getMonthGroupedFlights(flightsByStatus.upcoming, currentDate);
    },
    [flightsByStatus.upcoming, currentDate]
  );
  const monthDaysPast = useMemo(
    () => {
      return getMonthGroupedFlights(flightsByStatus.past, currentDate);
    },
    [flightsByStatus.past, currentDate]
  );

  // Рейсы будущие: неделя с текущего дня/или месяц
  const displayedUpcoming = viewMode === "week"
    ? groupFlightsByDay(flightsByStatus.upcoming, weekDays)
    : monthDays;

  // Рейсы завершённые: вся неделя/месяц
  const displayedPast = viewMode === "week"
    ? groupFlightsByDay(
        flightsByStatus.past,
        Array.from({ length: differenceInCalendarDays(weekEnd, fullWeekStart) + 1 })
          .map((_, idx) => {
            const d = new Date(fullWeekStart);
            d.setDate(d.getDate() + idx);
            return d;
          })
      )
    : monthDaysPast;

  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setCurrentDate(date);
      setShowCalendar(false);
    }
  };

  return (
    <div className="space-y-6 schedule-container">
      <div className="schedule-header">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Расписание полетов</h1>
        <div className="flex items-center gap-2">
          <div className="month-navigation">
            <Button variant="outline" size="icon" onClick={prevMonth} className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Popover open={showCalendar} onOpenChange={setShowCalendar}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="month-selector">
                  <CalendarIcon className="h-4 w-4 mr-1" />
                  <span className="hidden sm:inline">{format(currentDate, 'LLLL yyyy', { locale: ru })}</span>
                  <span className="sm:hidden">{format(currentDate, 'LLL', { locale: ru })}</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  selected={currentDate}
                  onSelect={handleDateSelect}
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
            <Button variant="outline" size="icon" onClick={nextMonth} className="h-8 w-8">
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="view-toggle">
            <Button
              variant={viewMode === "week" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("week")}
            >
              <LayoutList className="h-4 w-4 mr-1" />
              Неделя
            </Button>
            <Button
              variant={viewMode === "month" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("month")}
            >
              <List className="h-4 w-4 mr-1" />
              Месяц
            </Button>
          </div>
        </div>
      </div>
      <Tabs defaultValue="upcoming" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="upcoming">Предстоящие рейсы</TabsTrigger>
          <TabsTrigger value="past">Прошедшие рейсы</TabsTrigger>
        </TabsList>
        <TabsContent value="upcoming">
          <div className="week-view">
            {isLoading ? (
              <div className="text-center w-full py-8">Загрузка...</div>
            ) : displayedUpcoming.length === 0 ? (
              <div className="text-center w-full py-8">Нет предстоящих рейсов</div>
            ) : displayedUpcoming.map((day, index) => (
                <div key={index} className="day-column">
                  <div className="day-header">
                    <div className="text-sm font-bold">
                      {formatWeekday(day.date)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatDayMonth(day.date)}
                    </div>
                  </div>
                  {day.flights.length > 0 ? (
                    <div className="space-y-2">
                      {day.flights.map((flight) => (
                        <FlightCard key={flight.id} flight={flight} />
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground text-center py-4">
                      Нет рейсов
                    </div>
                  )}
                </div>
              )
            )}
          </div>
        </TabsContent>
        <TabsContent value="past">
          <div className="week-view">
            {isLoading ? (
              <div className="text-center w-full py-8">Загрузка...</div>
            ) : displayedPast.length === 0 ? (
              <div className="text-center w-full py-8">Нет прошлых рейсов</div>
            ) : displayedPast.map((day, index) => (
                <div key={index} className="day-column">
                  <div className="day-header">
                    <div className="text-sm font-bold">{formatWeekday(day.date)}</div>
                    <div className="text-xs text-muted-foreground">{formatDayMonth(day.date)}</div>
                  </div>
                  {day.flights.length > 0 ? (
                    <div className="space-y-2">
                      {day.flights.map((flight) => (
                        <FlightCard key={flight.id} flight={flight} />
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground text-center py-4">
                      Нет рейсов
                    </div>
                  )}
                </div>
              )
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SchedulePage;

