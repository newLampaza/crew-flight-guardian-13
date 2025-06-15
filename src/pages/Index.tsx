// Главная страница разбита на отдельные блоки для удобства интеграции с БД и API

import React from "react";
import UserGreeting from "@/components/index/UserGreeting";
import FlightStatsCard from "@/components/index/FlightStatsCard";
import CrewCard from "@/components/index/CrewCard";
import FatigueAnalysisCard from "@/components/index/FatigueAnalysisCard";

const Index = () => {
  return (
    <div className="space-y-8 max-w-7xl mx-auto animate-fade-in">
      <UserGreeting />
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
        <FlightStatsCard />
        <CrewCard />
        <FatigueAnalysisCard />
      </div>
    </div>
  );
};

export default Index;
