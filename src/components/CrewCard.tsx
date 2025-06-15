
import React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Users } from "lucide-react";
import { CrewMember } from "@/hooks/useCrew";

interface CrewCardProps {
  crewData: CrewMember[] | undefined;
  isLoading: boolean;
  error: unknown;
}

const CrewCard = ({ crewData, isLoading, error }: CrewCardProps) => {
  console.log('CrewCard received crewData:', crewData);
  console.log('Type:', typeof crewData);
  console.log('Is array:', Array.isArray(crewData));
  console.log('Length:', crewData?.length);
  console.log('Is loading:', isLoading);
  console.log('Error:', error);
  
  return (
    <Card className="hover-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-2xl flex items-center gap-3">
          <Users className="h-6 w-6 text-primary" />
          Текущий экипаж
        </CardTitle>
        <CardDescription className="text-base">
          {crewData && Array.isArray(crewData) && crewData.length > 0
            ? "Ваш последний рейс"
            : "Нет информации об экипаже"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="py-8 text-center text-muted-foreground">Загрузка...</div>
        ) : error ? (
          <div className="py-8 text-center">
            <div className="text-destructive mb-2">Ошибка загрузки экипажа</div>
            <div className="text-sm text-muted-foreground">
              {error instanceof Error ? error.message : 'Неизвестная ошибка'}
            </div>
          </div>
        ) : crewData && Array.isArray(crewData) && crewData.length > 0 ? (
          <div className="space-y-4">
            {crewData.map((member, index) => (
              <div key={member.id || index} className="flex justify-between items-center gap-4">
                <div className="flex-grow truncate">
                  <span className="block text-base font-medium truncate">{member.name}</span>
                  <span className="block text-sm text-muted-foreground truncate">{member.position}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center text-muted-foreground">
            <div>Нет информации об экипаже</div>
            {crewData !== undefined && (
              <div className="text-xs mt-2 opacity-60">
                Получены данные: {JSON.stringify(crewData)}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CrewCard;
