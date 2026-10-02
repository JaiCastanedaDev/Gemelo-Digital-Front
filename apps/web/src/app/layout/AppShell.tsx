import { Outlet } from 'react-router';
import styles from './AppShell.module.css';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

export function AppShell() {
  return (
    <div className={styles.shell}>
      <a href="#contenido" className={styles.skip}>
        Saltar al contenido
      </a>
      <Header />
      <Sidebar />
      <main id="contenido" className={styles.main} tabIndex={-1}>
        <Outlet />
      </main>
    </div>
  );
}
