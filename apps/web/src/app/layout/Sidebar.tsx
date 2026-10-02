import { NavLink } from 'react-router';
import { useSession } from '../session/SessionProvider';
import styles from './AppShell.module.css';
import { navItemsFor } from './navItems';

export function Sidebar() {
  const { session } = useSession();
  if (!session) return null;
  return (
    <nav className={styles.nav} aria-label="Secciones">
      <ul>
        {navItemsFor(session.claims.role).map(({ to, label, Icon }) => (
          <li key={to}>
            <NavLink to={to} end={to === '/'} className={styles.link} title={label}>
              <Icon aria-hidden="true" size={20} />
              <span className={styles.label}>{label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
