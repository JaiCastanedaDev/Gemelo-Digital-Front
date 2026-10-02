import type { Role } from '@gd/api';
import { Link } from 'react-router';
import styles from './Home.module.css';

const LINKS: { to: string; title: string; text: string; roles: Role[] }[] = [
  { to: '/estructural', title: 'Estructural', text: 'Vibraciones, inclinación y fisuras', roles: ['ADMIN'] },
  { to: '/consumos', title: 'Consumos', text: 'Agua y energía de zonas comunes', roles: ['ADMIN'] },
  { to: '/aire', title: 'Calidad del aire', text: 'CO₂ en zonas comunes', roles: ['ADMIN', 'RESIDENTE'] },
  { to: '/mantenimiento', title: 'Mantenimiento', text: 'Tareas pendientes y evidencias', roles: ['ADMIN'] },
  { to: '/gemelo', title: 'Gemelo 3D', text: 'Estado de los sensores en el modelo', roles: ['ADMIN'] },
  { to: '/alertas', title: 'Alertas', text: 'Historial de avisos del edificio', roles: ['RESIDENTE'] },
];

export function CategoryLinks({ role }: { role: Role }) {
  return (
    <nav className={styles.links} aria-label="Ir a una sección">
      {LINKS.filter((link) => link.roles.includes(role)).map((link) => (
        <Link key={link.to} to={link.to} className={styles.linkCard}>
          <strong>{link.title}</strong>
          <span>{link.text}</span>
        </Link>
      ))}
    </nav>
  );
}
