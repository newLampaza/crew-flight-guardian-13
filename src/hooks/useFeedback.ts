
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "@/components/ui/use-toast";

export interface Feedback {
  id: number;
  type: 'flight' | 'fatigue_analysis';
  entityId: number;
  entityInfo: string;
  rating: number;
  comments: string;
  date: string;
}

export interface SubmitFeedbackData {
  entityType: 'flight' | 'fatigue_analysis';
  entityId: number;
  rating: number;
  comments: string;
}

const api = axios.create({
  baseURL: 'http://localhost:5000',
  withCredentials: true,
});

// Add JWT token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("authToken") || localStorage.getItem("fatigue-guard-token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const fetchFeedback = async (): Promise<Feedback[]> => {
  try {
    const response = await api.get("/api/feedback");
    return response.data || [];
  } catch (error) {
    console.error("Error fetching feedback:", error);
    throw error;
  }
};

const submitFeedbackApi = async (data: SubmitFeedbackData) => {
  try {
    const response = await api.post("/api/feedback", {
      entity_type: data.entityType,
      entity_id: data.entityId,
      rating: data.rating,
      comments: data.comments
    });
    return response.data;
  } catch (error) {
    console.error("Error submitting feedback:", error);
    throw error;
  }
};

export function useFeedback() {
  const queryClient = useQueryClient();

  const {
    data: feedbackHistory = [],
    isLoading,
    error
  } = useQuery({
    queryKey: ["feedback"],
    queryFn: fetchFeedback,
    retry: 2,
    staleTime: 5 * 60 * 1000,
  });

  const submitMutation = useMutation({
    mutationFn: submitFeedbackApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feedback"] });
      toast({
        title: "Успешно",
        description: "Отзыв успешно отправлен",
      });
    },
    onError: (error: any) => {
      let errorMessage = "Ошибка при отправке отзыва";
      
      if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      }
      
      toast({
        title: "Ошибка",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const submitFeedback = (data: SubmitFeedbackData) => {
    submitMutation.mutate(data);
  };

  const hasFeedbackForEntity = (entityType: 'flight' | 'fatigue_analysis', entityId: number): boolean => {
    return feedbackHistory.some(
      feedback => feedback.type === entityType && feedback.entityId === entityId
    );
  };

  return {
    feedbackHistory,
    isLoading,
    error,
    submitFeedback,
    hasFeedbackForEntity,
    isSubmitting: submitMutation.isPending,
  };
}
