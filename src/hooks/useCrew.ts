
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";

export interface CrewMember {
  id: number;
  name: string;
  position: string;
}

export function useCrew() {
  const { user, isAuthenticated } = useAuth();
  
  return useQuery<CrewMember[]>({
    queryKey: ["crewData", user?.id],
    queryFn: async () => {
      console.log('Fetching crew data for user:', user?.id);
      
      try {
        // Проверяем аутентификацию перед запросом
        if (!isAuthenticated || !user?.id) {
          console.log('User not authenticated, skipping crew fetch');
          return [];
        }

        const response = await fetch('/api/crew', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-User-Id': user.id.toString(),
          },
        });
        
        console.log('Crew API response status:', response.status);
        console.log('Crew API response content-type:', response.headers.get('content-type'));
        
        // Проверяем, что ответ действительно JSON
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          console.error('Response is not JSON:', contentType);
          const text = await response.text();
          console.error('Response text:', text.substring(0, 200));
          throw new Error(`Expected JSON but received ${contentType}`);
        }
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Raw crew API response:', data);
        console.log('Response type:', typeof data);
        console.log('Is array:', Array.isArray(data));
        
        // Проверяем различные форматы ответа
        if (Array.isArray(data)) {
          console.log('Data is already an array:', data);
          return data;
        }
        
        // Если данные обернуты в объект
        if (data && typeof data === 'object') {
          if (Array.isArray(data.crew)) {
            console.log('Found crew array in data.crew:', data.crew);
            return data.crew;
          }
          if (Array.isArray(data.data)) {
            console.log('Found crew array in data.data:', data.data);
            return data.data;
          }
          if (Array.isArray(data.members)) {
            console.log('Found crew array in data.members:', data.members);
            return data.members;
          }
        }
        
        console.warn('Crew data is not an array format:', data);
        console.warn('Returning empty array as fallback');
        return [];
        
      } catch (error) {
        console.error('Error fetching crew data:', error);
        throw error;
      }
    },
    // Исправляем условие enabled - запрос должен выполняться только если пользователь аутентифицирован
    enabled: isAuthenticated && !!user?.id,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
    // Добавляем retry: false, чтобы не повторять запросы при ошибках аутентификации
    retry: (failureCount, error) => {
      // Не повторяем запросы, если это ошибка парсинга JSON (HTML ответ)
      if (error instanceof SyntaxError && error.message.includes('Unexpected token')) {
        return false;
      }
      return failureCount < 3;
    },
  });
}
