import { Link } from 'react-router';

export function NotFoundPage() {
  return (
    <section>
      <h1>Página no encontrada</h1>
      <p>La dirección que abriste no existe.</p>
      <Link to="/">Volver al estado general</Link>
    </section>
  );
}
