import type { Role } from '@gd/api';
import { Outlet } from 'react-router';
import { ForbiddenPage } from '../pages/ForbiddenPage';
import { useSession } from '../session/SessionProvider';

/** Solo UX: la autorización real la hace el backend (que responde 403). */
export function RequireRole({ roles }: { roles: Role[] }) {
  const { session } = useSession();
  if (!session || !roles.includes(session.claims.role)) return <ForbiddenPage />;
  return <Outlet />;
}
