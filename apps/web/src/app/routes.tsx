import { Route, Routes } from 'react-router';
import { AlertsPage } from '../features/alerts/AlertsPage';
import { LoginPage } from '../features/auth/LoginPage';
import { HomePage } from '../features/home/HomePage';
import { RequireAuth } from './guards/RequireAuth';
import { RequireRole } from './guards/RequireRole';
import { AppShell } from './layout/AppShell';
import { NotFoundPage } from './pages/NotFoundPage';
import { PendingSection } from './pages/PendingSection';

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route index element={<HomePage />} />
        <Route path="alertas" element={<AlertsPage />} />
        <Route path="aire" element={<PendingSection title="Calidad del aire" />} />
        <Route element={<RequireRole roles={['ADMIN']} />}>
          <Route path="estructural" element={<PendingSection title="Estructural" />} />
          <Route path="consumos" element={<PendingSection title="Consumos" />} />
          <Route path="gemelo" element={<PendingSection title="Gemelo 3D" />} />
          <Route path="sensores" element={<PendingSection title="Sensores" />} />
          <Route path="mantenimiento" element={<PendingSection title="Mantenimiento" />} />
          <Route path="reportes" element={<PendingSection title="Reportes" />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
