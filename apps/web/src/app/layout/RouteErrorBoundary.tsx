import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Link } from 'react-router';
import { Button } from '../../ui/Button';
import styles from './RouteErrorBoundary.module.css';

interface Props {
  /** Cuando cambia (p. ej. el pathname), el error se descarta y se vuelve a intentar renderizar. */
  resetKey: string;
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class RouteErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Error de render en la sección', error, info.componentStack);
  }

  override componentDidUpdate(prev: Props): void {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.reset();
  }

  private reset = (): void => {
    this.setState({ error: null });
  };

  override render(): ReactNode {
    if (!this.state.error) return this.props.children;
    return (
      <section className={styles.error} role="alert">
        <h1 className={styles.title}>Algo salió mal en esta sección.</h1>
        <p>El resto de la aplicación sigue funcionando. Puedes intentarlo de nuevo o volver al inicio.</p>
        <div className={styles.actions}>
          <Button variant="secondary" onClick={this.reset}>
            Reintentar
          </Button>
          <Link to="/" onClick={this.reset}>
            Volver al estado general
          </Link>
        </div>
      </section>
    );
  }
}
