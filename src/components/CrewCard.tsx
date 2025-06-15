
import React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Users } from "lucide-react";
import { CrewMember } from "@/hooks/useCrew";

interface CrewCardProps {
  crewData: CrewMember[] | undefined;
  isLoading: boolean;
  error: unknown;
}

const CrewCard = ({ crewData, isLoading, error }: CrewCardProps) => (
  <Card className="hover-card">
    <CardHeader className="pb-2">
      <CardTitle className="text-2xl flex items-center gap-3">
        <Users className="h-6 w-6 text-primary" />
        Текущий экипаж
      </CardTitle>
      <CardDescription className="text-base">
        {crewData && crewData.length > 0
          ? "Ваш последний рейс"
          : "Нет информации об экипаже"}
      </CardDescription>
    </CardHeader>
    <CardContent>
      {isLoading ? (
        <div className="py-8 text-center text-muted-foreground">Загрузка...</div>
      ) : error ? (
        <div className="py-8 text-center text-destructive">
          Ошибка загрузки экипажа
        </div>
      ) : crewData && crewData.length > 0 ? (
        <div className="space-y-4">
          {crewData.map((member) => (
            <div key={member.id} className="flex justify-between items-center gap-4">
              <div className="flex-grow truncate">
                <span className="block text-base font-medium truncate">{member.name}</span>
                <span className="block text-sm text-muted-foreground truncate">{member.position}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-8 text-center text-muted-foreground">
          Нет информации об экипаже
        </div>
      )}
    </CardContent>
  </Card>
);

export default CrewCard;
