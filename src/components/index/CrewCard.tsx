
import React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Users } from "lucide-react";

const mockCrewData = [
  { id: 1, name: "Иванов И.И.", position: "Капитан" },
  { id: 2, name: "Петрова А.С.", position: "Второй пилот" },
  { id: 3, name: "Сидоров М.В.", position: "Бортпроводник" },
  { id: 4, name: "Кузнецов Д.А.", position: "Бортпроводник" }
];

const CrewCard: React.FC<{ crewData?: typeof mockCrewData }> = ({ crewData = mockCrewData }) => (
  <Card className="hover-card">
    <CardHeader className="pb-2">
      <CardTitle className="text-2xl flex items-center gap-3">
        <Users className="h-6 w-6 text-primary" />
        Текущий экипаж
      </CardTitle>
      <CardDescription className="text-base">Рейс SU-1492, Москва - Санкт-Петербург</CardDescription>
    </CardHeader>
    <CardContent>
      <div className="space-y-4">
        {crewData.map(member => (
          <div key={member.id} className="flex justify-between items-center gap-4">
            <div className="flex-grow truncate">
              <span className="block text-base font-medium truncate">{member.name}</span>
              <span className="block text-sm text-muted-foreground truncate">{member.position}</span>
            </div>
          </div>
        ))}
      </div>
    </CardContent>
  </Card>
);

export default CrewCard;
