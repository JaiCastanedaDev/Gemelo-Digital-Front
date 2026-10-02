import { ApiError, type Session } from '@gd/api';
import { useState, type FormEvent } from 'react';
import { useSession } from '../../app/session/SessionProvider';
import { Button } from '../../ui/Button';
import { useNow } from '../../ui/useNow';
import styles from './LoginPage.module.css';
import { loginErrorMessage } from './loginErrorMessage';

interface LoginFormProps {
  onSuccess: (session: Session) => void;
  defaultEmail?: string;
}

export function LoginForm({ onSuccess, defaultEmail = '' }: LoginFormProps) {
  const { login } = useSession();
  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [retryAt, setRetryAt] = useState<number | null>(null);
  const now = useNow(1000);
  const waitSeconds = retryAt === null ? 0 : Math.max(0, Math.ceil((retryAt - now.getTime()) / 1000));

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim() || !password) {
      setError('Escribe tu correo y tu contraseña.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const session = await login(email.trim(), password);
      onSuccess(session);
    } catch (err) {
      setError(loginErrorMessage(err));
      if (err instanceof ApiError && err.status === 429) {
        setRetryAt(Date.now() + (err.retryAfterSeconds ?? 30) * 1000);
      }
      setPassword('');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <label htmlFor="login-email">Correo electrónico</label>
      <input
        id="login-email"
        type="email"
        autoComplete="username"
        autoFocus={!defaultEmail}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <label htmlFor="login-password">Contraseña</label>
      <input
        id="login-password"
        type="password"
        autoComplete="current-password"
        autoFocus={Boolean(defaultEmail)}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {error && (
        <p className={styles.error} role="alert">
          {error}
          {waitSeconds > 0 && ` Podrás intentarlo en ${waitSeconds} s.`}
        </p>
      )}
      <Button type="submit" disabled={submitting || waitSeconds > 0}>
        {submitting ? 'Ingresando…' : 'Ingresar'}
      </Button>
    </form>
  );
}
