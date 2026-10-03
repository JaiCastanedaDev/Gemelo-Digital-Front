import { LogOut } from 'lucide-react';
import { useNavigate } from 'react-router';
import { Button } from '../../ui/Button';
import { ConnectionIndicator } from '../connection/ConnectionIndicator';
import type { ConnectionKind } from '../connection/connectionState';
import { useSession } from '../session/SessionProvider';
import { AlertsBell } from './AlertsBell';
import styles from './AppShell.module.css';
import { SoundButton } from './SoundButton';

const ROLE_LABEL = { ADMIN: 'Administración', RESIDENTE: 'Residente' } as const;

export function Header({ connection }: { connection: ConnectionKind }) {
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
        <ConnectionIndicator kind={connection} />
        {session && <AlertsBell role={session.claims.role} />}
        <SoundButton />
        <span className={styles.userName}>
          {name}
          {session && ` · ${ROLE_LABEL[session.claims.role]}`}
        </span>
        <Button variant="secondary" className={styles.iconButton} onClick={() => void handleLogout()}>
          <LogOut aria-hidden="true" size={18} />
          <span className={styles.btnText}>Cerrar sesión</span>
        </Button>
      </div>
    </header>
  );
}
