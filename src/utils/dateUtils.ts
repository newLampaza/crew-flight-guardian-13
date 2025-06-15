
/**
 * Utility functions for standardized date handling
 * All dates in the system should use ISO 8601 format: YYYY-MM-DDTHH:MM:SS
 */

export const formatDateTimeForDatabase = (date: Date): string => {
  return date.toISOString().slice(0, 19); // Remove milliseconds and timezone
};

export const formatDateForDatabase = (date: Date): string => {
  return date.toISOString().slice(0, 10); // YYYY-MM-DD format
};

export const parseDatabaseDateTime = (dateString: string): Date => {
  // Handle both ISO format and SQLite datetime format
  if (!dateString) {
    throw new Error('Invalid date string');
  }
  
  // Ensure the date string is in proper ISO format
  let isoString = dateString;
  if (!dateString.includes('T')) {
    isoString = dateString.replace(' ', 'T');
  }
  
  // Remove timezone suffix if present for local time handling
  isoString = isoString.replace('Z', '').replace(/[+-]\d{2}:\d{2}$/, '');
  
  return new Date(isoString);
};

export const formatDisplayDateTime = (dateString: string, locale: string = 'ru-RU'): string => {
  try {
    const date = parseDatabaseDateTime(dateString);
    return date.toLocaleString(locale, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return dateString; // Fallback to original string if parsing fails
  }
};

export const formatDisplayDate = (dateString: string, locale: string = 'ru-RU'): string => {
  try {
    const date = parseDatabaseDateTime(dateString);
    return date.toLocaleDateString(locale, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  } catch {
    return dateString; // Fallback to original string if parsing fails
  }
};

export const formatDisplayTime = (dateString: string, locale: string = 'ru-RU'): string => {
  try {
    const date = parseDatabaseDateTime(dateString);
    return date.toLocaleTimeString(locale, {
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return dateString; // Fallback to original string if parsing fails
  }
};

export const getCurrentDateTime = (): string => {
  return formatDateTimeForDatabase(new Date());
};

export const getCurrentDate = (): string => {
  return formatDateForDatabase(new Date());
};

export const isToday = (dateString: string): boolean => {
  try {
    const date = parseDatabaseDateTime(dateString);
    const today = new Date();
    return date.toDateString() === today.toDateString();
  } catch {
    return false;
  }
};

export const calculateDuration = (startDateTime: string, endDateTime: string): number => {
  try {
    const start = parseDatabaseDateTime(startDateTime);
    const end = parseDatabaseDateTime(endDateTime);
    return Math.round((end.getTime() - start.getTime()) / (1000 * 60)); // Minutes
  } catch {
    return 0;
  }
};

export const addMinutesToDateTime = (dateString: string, minutes: number): string => {
  try {
    const date = parseDatabaseDateTime(dateString);
    const newDate = new Date(date.getTime() + minutes * 60000);
    return formatDateTimeForDatabase(newDate);
  } catch {
    return dateString;
  }
};

export const getCooldownEnd = (minutes: number = 30): string => {
  const futureTime = new Date(Date.now() + minutes * 60000);
  return formatDateTimeForDatabase(futureTime);
};
