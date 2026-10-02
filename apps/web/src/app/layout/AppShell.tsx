import { Outlet, useLocation } from 'react-router';
import { ToastViewport } from '../../ui/toast/ToastProvider';
import styles from './AppShell.module.css';
import { Header } from './Header';
import { RouteErrorBoundary } from './RouteErrorBoundary';
import { Sidebar } from './Sidebar';

export function AppShell() {
  const { pathname } = useLocation();
  return (
    <div className={styles.shell}>
      <a href="#contenido" className={styles.skip}>
        Saltar al contenido
      </a>
      <Header />
      <Sidebar />
      <main id="contenido" className={styles.main} tabIndex={-1}>
        <RouteErrorBoundary resetKey={pathname}>
          <Outlet />
        </RouteErrorBoundary>
      </main>
      <ToastViewport />
    </div>
  );
}
