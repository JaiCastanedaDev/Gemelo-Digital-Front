import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { ReloginModal } from '../../features/auth/ReloginModal';
import { SplashScreen } from '../pages/SplashScreen';
import { useSession } from '../session/SessionProvider';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useSession();
  const location = useLocation();

  if (status === 'restoring') return <SplashScreen />;
  if (status === 'anonymous') {
    const volver = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?volver=${volver}`} replace />;
  }

  const expired = status === 'expired';
  return (
    <>
      <div inert={expired}>{children}</div>
      {expired && <ReloginModal />}
    </>
  );
}
