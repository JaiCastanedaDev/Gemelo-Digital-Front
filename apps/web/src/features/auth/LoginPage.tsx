import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { SplashScreen } from '../../app/pages/SplashScreen';
import { useSession } from '../../app/session/SessionProvider';
import { LoginForm } from './LoginForm';
import styles from './LoginPage.module.css';
import { safeRedirect } from './safeRedirect';

export function LoginPage() {
  const { status } = useSession();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const target = safeRedirect(params.get('volver'));

  if (status === 'restoring') return <SplashScreen />;
  if (status === 'authenticated') return <Navigate to={target} replace />;

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <h1>Gemelo Digital</h1>
        <p>Ingresa para ver el estado de tu conjunto.</p>
        <LoginForm onSuccess={() => navigate(target, { replace: true })} />
      </div>
    </main>
  );
}
