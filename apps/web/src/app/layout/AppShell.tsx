import { Outlet, useLocation } from 'react-router';
import { ToastViewport } from '../../ui/toast/ToastProvider';
import { OfflineBanner } from '../connection/OfflineBanner';
import { useConnection } from '../connection/useConnection';
import styles from './AppShell.module.css';
import { Header } from './Header';
import { RouteErrorBoundary } from './RouteErrorBoundary';
import { Sidebar } from './Sidebar';

export function AppShell() {
  const { pathname } = useLocation();
  const connection = useConnection();
  return (
    <div className={styles.shell}>
      <a href="#contenido" className={styles.skip}>
        Saltar al contenido
      </a>
      <Header connection={connection.kind} />
      <Sidebar />
      <main id="contenido" className={styles.main} tabIndex={-1}>
        <OfflineBanner visible={connection.showBanner} />
        <RouteErrorBoundary resetKey={pathname}>
          <Outlet />
        </RouteErrorBoundary>
      </main>
      <ToastViewport />
    </div>
  );
}
