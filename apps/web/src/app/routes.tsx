import { Route, Routes } from 'react-router';
import { LoginPage } from '../features/auth/LoginPage';
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
        <Route index element={<PendingSection title="Estado general" />} />
        <Route path="alertas" element={<PendingSection title="Alertas" />} />
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
