
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/context/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import RoleProtectedRoute from "@/components/RoleProtectedRoute";

// Import pages
import Index from "@/pages/Index";
import LoginPage from "@/pages/LoginPage";
import Dashboard from "@/pages/Dashboard";
import FatigueAnalysisPage from "@/pages/FatigueAnalysisPage";
import CognitiveTestsPage from "@/pages/CognitiveTestsPage";
import SchedulePage from "@/pages/SchedulePage";
import FeedbackPage from "@/pages/FeedbackPage";
import TrainingPage from "@/pages/TrainingPage";
import SettingsPage from "@/pages/SettingsPage";
import AdminDashboard from "@/pages/AdminDashboard";
import AdminHome from "@/pages/AdminHome";
import MedicalDashboard from "@/pages/MedicalDashboard";
import MedicalHome from "@/pages/MedicalHome";
import ForbiddenPage from "@/pages/ForbiddenPage";
import NotFound from "@/pages/NotFound";
import PredictTestPage from "@/pages/PredictTestPage";

import "./App.css";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
        <AuthProvider>
          <Router>
            <div className="min-h-screen bg-background font-sans antialiased">
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/forbidden" element={<ForbiddenPage />} />
                
                {/* Публичный роут для тестирования predict */}
                <Route path="/predict-test" element={<PredictTestPage />} />
                
                {/* Protected pilot routes */}
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <RoleProtectedRoute allowedRoles={['pilot']}>
                        <Dashboard />
                      </RoleProtectedRoute>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/fatigue-analysis"
                  element={
                    <ProtectedRoute>
                      <RoleProtectedRoute allowedRoles={['pilot']}>
                        <FatigueAnalysisPage />
                      </RoleProtectedRoute>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/cognitive-tests"
                  element={
                    <ProtectedRoute>
                      <RoleProtectedRoute allowedRoles={['pilot']}>
                        <CognitiveTestsPage />
                      </RoleProtectedRoute>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/schedule"
                  element={
                    <ProtectedRoute>
                      <RoleProtectedRoute allowedRoles={['pilot']}>
                        <SchedulePage />
                      </RoleProtectedRoute>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/feedback"
                  element={
                    <ProtectedRoute>
                      <RoleProtectedRoute allowedRoles={['pilot']}>
                        <FeedbackPage />
                      </RoleProtectedRoute>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/training"
                  element={
                    <ProtectedRoute>
                      <RoleProtectedRoute allowedRoles={['pilot']}>
                        <TrainingPage />
                      </RoleProtectedRoute>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/settings"
                  element={
                    <ProtectedRoute>
                      <RoleProtectedRoute allowedRoles={['pilot']}>
                        <SettingsPage />
                      </RoleProtectedRoute>
                    </ProtectedRoute>
                  }
                />

                {/* Protected admin routes */}
                <Route
                  path="/admin"
                  element={
                    <ProtectedRoute>
                      <RoleProtectedRoute allowedRoles={['admin']}>
                        <AdminHome />
                      </RoleProtectedRoute>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/dashboard"
                  element={
                    <ProtectedRoute>
                      <RoleProtectedRoute allowedRoles={['admin']}>
                        <AdminDashboard />
                      </RoleProtectedRoute>
                    </ProtectedRoute>
                  }
                />

                {/* Protected medical routes */}
                <Route
                  path="/medical"
                  element={
                    <ProtectedRoute>
                      <RoleProtectedRoute allowedRoles={['medical']}>
                        <MedicalHome />
                      </RoleProtectedRoute>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/medical/dashboard"
                  element={
                    <ProtectedRoute>
                      <RoleProtectedRoute allowedRoles={['medical']}>
                        <MedicalDashboard />
                      </RoleProtectedRoute>
                    </ProtectedRoute>
                  }
                />

                <Route path="*" element={<NotFound />} />
              </Routes>
            </div>
            <Toaster />
          </Router>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
