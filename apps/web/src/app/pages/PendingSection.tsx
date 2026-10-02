/** Marcador temporal: los Planes 2–5 reemplazan cada sección. */
export function PendingSection({ title }: { title: string }) {
  return (
    <section>
      <h1>{title}</h1>
      <p>Esta sección se habilitará en una próxima entrega.</p>
    </section>
  );
}
