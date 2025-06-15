
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { MessageSquare, Star, AlertCircle } from "lucide-react";
import { StarRating } from "@/components/fatigue-analysis/StarRating";
import { useFeedback } from "@/hooks/useFeedback";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";

const FeedbackPage = () => {
  const [feedbackText, setFeedbackText] = useState("");
  const [flightRating, setFlightRating] = useState(0);
  const [selectedFlightId, setSelectedFlightId] = useState<number | null>(null);
  const { feedbackHistory, isLoading, submitFeedback, hasFeedbackForEntity } = useFeedback();
  const { data: flights = [], isLoading: flightsLoading } = useFlights();

  const hasExistingFeedback = (flightId: number) => {
    return hasFeedbackForEntity('flight', flightId);
  };

  // Функция проверяет, был ли рейс на этой неделе
  const isInCurrentWeek = (date: Date) => {
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1)); // Monday
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(start.getDate() + 6); // Sunday
    end.setHours(23, 59, 59, 999);

    return date >= start && date <= end;
  };

  useEffect(() => {
    if (flights?.length > 0 && !selectedFlightId) {
      const now = new Date();
      const availableFlight = flights.find(flight => {
        const arrivalDate = new Date(flight.arrival_time);
        return arrivalDate < now && isInCurrentWeek(arrivalDate) && !hasExistingFeedback(flight.flight_id);
      });

      if (availableFlight) {
        setSelectedFlightId(availableFlight.flight_id);
      } else if (flights.length > 0) {
        setSelectedFlightId(flights[0].flight_id);
      }
    }
  }, [flights, feedbackHistory]);

  const currentFlight = flights?.find(f => f.flight_id === selectedFlightId);
  const flightInfo = currentFlight
    ? `${currentFlight.from_code} - ${currentFlight.to_code}`
    : "Загрузка...";

  const currentFlightHasFeedback = selectedFlightId ? hasExistingFeedback(selectedFlightId) : false;

  const availableFlights = flights?.filter(flight => {
    const arrivalDate = new Date(flight.arrival_time);
    const now = new Date();
    return arrivalDate < now && isInCurrentWeek(arrivalDate) && !hasExistingFeedback(flight.flight_id);
  }) || [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!feedbackText || flightRating === 0 || !selectedFlightId) {
      return;
    }

    submitFeedback({
      entityType: "flight",
      entityId: selectedFlightId,
      rating: flightRating,
      comments: feedbackText
    });

    setFeedbackText("");
    setFlightRating(0);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-3xl font-bold tracking-tight">Отзывы о полетах</h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            Отзыв о полете
          </CardTitle>
          <CardDescription>
            Выберите рейс для отправки отзыва
          </CardDescription>
          <div className="space-y-4 mt-2">
            {!flightsLoading && flights.length > 0 ? (
              <Select
                value={selectedFlightId?.toString() || ""}
                onValueChange={(value) => setSelectedFlightId(parseInt(value))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Выберите рейс" />
                </SelectTrigger>
                <SelectContent>
                  {availableFlights.map((flight) => {
                    const arrivalDate = new Date(flight.arrival_time);
                    const hasReview = hasExistingFeedback(flight.flight_id);

                    return (
                      <SelectItem
                        key={flight.flight_id}
                        value={flight.flight_id.toString()}
                        disabled={hasReview}
                      >
                        {flight.from_code} - {flight.to_code} ({format(arrivalDate, "dd.MM.yyyy HH:mm")})
                        {hasReview ? " (отзыв отправлен)" : ""}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            ) : (
              <div>{flightInfo}</div>
            )}
          </div>
        </CardHeader>

        {currentFlightHasFeedback && (
          <CardContent>
            <div className="mb-4 flex items-center gap-3 bg-secondary/70 rounded p-3">
              <AlertCircle className="h-4 w-4 text-amber-500" />
              <span className="font-medium">Отзыв уже существует для выбранного рейса. Пожалуйста, выберите другой рейс.</span>
            </div>
          </CardContent>
        )}

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Общая оценка полета</Label>
              <StarRating
                currentRating={flightRating}
                onRatingChange={setFlightRating}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="comment">Комментарий к полету</Label>
              <Textarea
                id="comment"
                placeholder="Опишите особенности полета, любые нештатные ситуации или проблемы"
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                rows={5}
              />
            </div>
          </CardContent>
          <CardFooter>
            <div className="space-y-2 w-full">
              <Button
                type="submit"
                className="w-full"
                disabled={!feedbackText || flightRating === 0 || currentFlightHasFeedback || availableFlights.length === 0}
              >
                Отправить отзыв
              </Button>

              <p className="text-xs text-muted-foreground text-center">
                Рейсы доступны для оценки в течение недели после завершения.
                Неоцененные рейсы автоматически получат 5 звезд.
              </p>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};

export default FeedbackPage;

