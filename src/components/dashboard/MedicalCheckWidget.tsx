
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Stethoscope } from "lucide-react";

export const MedicalCheckWidget = () => {
  return (
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
  );
};
