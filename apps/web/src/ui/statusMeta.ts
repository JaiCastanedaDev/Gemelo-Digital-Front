import type { StatusLevel } from '@gd/domain';
import { Ban, CircleCheck, Info, OctagonX, TriangleAlert, type LucideIcon } from 'lucide-react';

export const STATUS_META: Record<StatusLevel, { label: string; Icon: LucideIcon }> = {
  CRITICAL: { label: 'Crítico', Icon: OctagonX },
  WARNING: { label: 'Advertencia', Icon: TriangleAlert },
  INFO: { label: 'Informativo', Icon: Info },
  OK: { label: 'Normal', Icon: CircleCheck },
  OFFLINE: { label: 'Sin datos', Icon: Ban },
};
