import { LogOut } from 'lucide-react';
import { useNavigate } from 'react-router';
import { Button } from '../../ui/Button';
import { useSession } from '../session/SessionProvider';
import styles from './AppShell.module.css';

const ROLE_LABEL = { ADMIN: 'Administración', RESIDENTE: 'Residente' } as const;

export function Header() {
  const { session, logout } = useSession();
  const navigate = useNavigate();
  const name = session?.user?.name ?? session?.user?.email ?? 'Usuario';

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <header className={styles.header}>
      <span className={styles.brand}>Gemelo Digital</span>
      <div className={styles.user}>
        <span>
          {name}
          {session && ` · ${ROLE_LABEL[session.claims.role]}`}
        </span>
        <Button variant="secondary" onClick={() => void handleLogout()}>
          <LogOut aria-hidden="true" size={18} />
          Cerrar sesión
        </Button>
      </div>
    </header>
  );
}
