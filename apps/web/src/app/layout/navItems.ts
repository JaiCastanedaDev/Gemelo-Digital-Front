import type { Role } from '@gd/api';
import { Bell, Box, Building2, Cpu, FileText, Gauge, House, Wind, Wrench, type LucideIcon } from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  Icon: LucideIcon;
  roles: Role[];
}

const BOTH: Role[] = ['ADMIN', 'RESIDENTE'];
const ADMIN: Role[] = ['ADMIN'];

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Estado general', Icon: House, roles: BOTH },
  { to: '/alertas', label: 'Alertas', Icon: Bell, roles: BOTH },
  { to: '/estructural', label: 'Estructural', Icon: Building2, roles: ADMIN },
  { to: '/consumos', label: 'Consumos', Icon: Gauge, roles: ADMIN },
  { to: '/aire', label: 'Calidad del aire', Icon: Wind, roles: BOTH },
  { to: '/gemelo', label: 'Gemelo 3D', Icon: Box, roles: ADMIN },
  { to: '/sensores', label: 'Sensores', Icon: Cpu, roles: ADMIN },
  { to: '/mantenimiento', label: 'Mantenimiento', Icon: Wrench, roles: ADMIN },
  { to: '/reportes', label: 'Reportes', Icon: FileText, roles: ADMIN },
];

export function navItemsFor(role: Role): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}
