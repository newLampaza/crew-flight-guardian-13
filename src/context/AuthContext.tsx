import React, { createContext, useContext, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/components/ui/use-toast";
import axios from "axios";

export type UserRole = "pilot" | "admin" | "medical";

export interface User {
  id: string;
  name: string;
  role: UserRole;
  position: string;
  avatarUrl: string;
  username?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  loading: boolean;
  isAdmin: () => boolean;
  isMedical: () => boolean;
  isPilot: () => boolean;
  refreshToken: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Create axios instance with base URL
const api = axios.create({
  baseURL: 'http://localhost:5000/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add request interceptor for JWT
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('fatigue-guard-token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Redirect to login on authentication error
      localStorage.removeItem('fatigue-guard-token');
      localStorage.removeItem('fatigue-guard-user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Function to refresh the token
  const refreshToken = async () => {
    try {
      const token = localStorage.getItem('fatigue-guard-token');
      if (!token) {
        throw new Error('No token found');
      }

      const response = await api.post('/refresh-token');
      const newToken = response.data.token;
      localStorage.setItem('fatigue-guard-token', newToken);
    } catch (error) {
      console.error('Token refresh failed:', error);
      logout();
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      try {
        const storedUser = localStorage.getItem('fatigue-guard-user');
        const token = localStorage.getItem('fatigue-guard-token');
        
        if (storedUser && token) {
          const parsedUser = JSON.parse(storedUser);
          // Проверяем наличие всех необходимых полей
          if (parsedUser && parsedUser.name) {
            setUser(parsedUser);
          } else {
            console.error('Stored user data is incomplete:', parsedUser);
            // Попытаемся получить информацию о пользователе с сервера через endpoint /user-profile
            try {
              const response = await api.get('/user-profile');
              const userData = response.data;
              console.log('Fetched user profile data:', userData);
              
              if (userData && userData.name) {
                localStorage.setItem('fatigue-guard-user', JSON.stringify(userData));
                setUser(userData);
              } else {
                console.error('User profile data is still incomplete:', userData);
                throw new Error('Invalid user data');
              }
            } catch (userInfoError) {
              console.error('Failed to fetch user profile:', userInfoError);
              await logout();
            }
          }
          
          // Validate token on startup
          try {
            await api.get('/validate-token');
          } catch (error) {
            console.error('Token validation failed:', error);
            await logout();
          }
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        await logout();
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = async (username: string, password: string): Promise<boolean> => {
    setLoading(true);
    try {
      const response = await api.post('/login', { username, password });
      console.log('Login API response:', response.data);
      
      const { token, user } = response.data;

      if (token && user) {
        localStorage.setItem('fatigue-guard-token', token);
        localStorage.setItem('fatigue-guard-user', JSON.stringify(user));
        setUser(user);

        toast({
          title: "Вход выполнен успешно",
          description: `Добро пожаловать, ${user.name}`,
        });

        return true;
      }
      return false;
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Ошибка при входе в систему';
      toast({
        title: "Ошибка входа",
        description: errorMessage,
        variant: "destructive",
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await api.post('/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      localStorage.removeItem('fatigue-guard-token');
      localStorage.removeItem('fatigue-guard-user');
      navigate('/login');
      toast({
        title: "Выход из системы",
        description: "Вы успешно вышли из системы",
      });
    }
  };

  // Helper functions for role checks
  const isAdmin = () => user?.role === "admin";
  const isMedical = () => user?.role === "medical";
  const isPilot = () => user?.role === "pilot";

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        login,
        logout,
        loading,
        isAdmin,
        isMedical,
        isPilot,
        refreshToken
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
