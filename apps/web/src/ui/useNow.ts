import { useEffect, useState } from 'react';

/** Fecha actual que se refresca cada `intervalMs` para textos como "hace 5 min". */
export function useNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
