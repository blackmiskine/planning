import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/auth.store.js';
import { Layout } from './components/layout/Layout.js';
import { LoginPage } from './pages/LoginPage.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { SkillsPage } from './pages/SkillsPage.js';
import { EmployeesPage } from './pages/EmployeesPage.js';
import { EmployeeDetailPage } from './pages/EmployeeDetailPage.js';
import { PositionsPage } from './pages/PositionsPage.js';
import { PlanningsPage } from './pages/PlanningsPage.js';
import { PlanningDetailPage } from './pages/PlanningDetailPage.js';
import { SettingsPage } from './pages/SettingsPage.js';
import { PageLoader } from './components/ui/LoadingSpinner.js';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore();
  if (isLoading) return <PageLoader />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  const { checkAuth } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="skills" element={<SkillsPage />} />
        <Route path="employees" element={<EmployeesPage />} />
        <Route path="employees/:id" element={<EmployeeDetailPage />} />
        <Route path="positions" element={<PositionsPage />} />
        <Route path="plannings" element={<PlanningsPage />} />
        <Route path="plannings/:id" element={<PlanningDetailPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
