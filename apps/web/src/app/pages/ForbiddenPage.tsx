import { Link } from 'react-router';

export function ForbiddenPage() {
  return (
    <section>
      <h1>Sin permiso</h1>
      <p>No tienes permiso para ver esta sección.</p>
      <Link to="/">Volver al estado general</Link>
    </section>
  );
}
