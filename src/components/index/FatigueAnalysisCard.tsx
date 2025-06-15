
import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Battery, AlertTriangle, Activity, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const FatigueAnalysisCard: React.FC = () => (
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
          <div className="mb-3 text-6xl font-bold text-status-warning">65%</div>
          <div className="text-base text-muted-foreground">Средний уровень усталости</div>
        </div>
          
        <div className="bg-amber-50 dark:bg-amber-500/10 p-4 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-6 w-6 text-amber-500 mt-0.5" />
            <div>
              <p className="text-base font-medium">Превышение нормы</p>
              <p className="text-sm text-muted-foreground">Рекомендуется дополнительный отдых перед следующим рейсом</p>
            </div>
          </div>
        </div>
        
        <div className="flex justify-between items-center">
          <div className="flex items-center w-2/3">
            <Activity className="h-5 w-5 text-primary mr-2" />
            <span className="text-base truncate">Динамика за неделю</span>
          </div>
          <div className="flex items-center w-1/3 justify-end">
            <span className="text-rose-500 mr-2 text-base">+5%</span>
            <div className="w-20 h-2 bg-secondary rounded-full overflow-hidden">
              <div className="h-full bg-rose-500 rounded-full" style={{ width: "60%" }}></div>
            </div>
          </div>
        </div>
        
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
);

export default FatigueAnalysisCard;
