import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { useSession } from '../../app/session/SessionProvider';
import { Button } from '../../ui/Button';
import { LoginForm } from './LoginForm';
import styles from './ReloginModal.module.css';

export function ReloginModal() {
  const { session, logout } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const previousSub = session?.claims.sub;

  return (
    <div className={styles.backdrop}>
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="relogin-title">
        <h2 id="relogin-title">Tu sesión expiró</h2>
        <p>Vuelve a ingresar para continuar. Lo que estabas haciendo sigue en pantalla.</p>
        <LoginForm
          defaultEmail={session?.user?.email ?? ''}
          onSuccess={(next) => {
            if (next.claims.sub !== previousSub) navigate('/', { replace: true });
            else void queryClient.invalidateQueries();
          }}
        />
        <Button
          variant="secondary"
          className={styles.logout}
          onClick={() => {
            void logout().then(() => navigate('/login', { replace: true }));
          }}
        >
          Salir
        </Button>
      </div>
    </div>
  );
}
