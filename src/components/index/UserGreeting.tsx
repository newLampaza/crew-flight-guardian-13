
import React from "react";
import { useAuth } from "@/context/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PlaneTakeoff, Users } from "lucide-react";

const UserGreeting: React.FC = () => {
  const { user } = useAuth();

  return (
    <div className="mb-8">
      <div className="bg-gradient-to-br from-sidebar-primary/10 to-sidebar/5 rounded-xl shadow-md p-8 flex flex-col md:flex-row items-center gap-8">
        <Avatar className="h-28 w-28 border-4 border-background shadow-lg">
          <AvatarImage src={user?.avatarUrl} alt={user?.name} className="object-cover"/>
          <AvatarFallback className="text-3xl bg-primary/10 text-primary">
            {user?.name?.charAt(0)}
          </AvatarFallback>
        </Avatar>
        <div className="space-y-3 text-center md:text-left flex-grow">
          <h1 className="text-4xl font-bold tracking-tight leading-tight">
            Добро пожаловать, {user?.name}
          </h1>
          <div className="flex flex-col md:flex-row gap-4 md:gap-8 text-muted-foreground text-lg">
            <div className="flex items-center gap-2 justify-center md:justify-start">
              <PlaneTakeoff className="h-5 w-5" />
              <span>{user?.position}</span>
            </div>
            <div className="flex items-center gap-2 justify-center md:justify-start">
              <Users className="h-5 w-5" />
              <span>{user?.role}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
export default UserGreeting;
