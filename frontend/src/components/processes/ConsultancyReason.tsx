export default function ConsultancyReason({
  reason,
}: {
  reason?: string | null;
}) {
  if (!reason?.trim()) return null;
  return (
    <section
      aria-label="Motivo da consultoria"
      className="mx-3 my-4 rounded-lg border border-border bg-surface p-3 md:mx-6"
    >
      <h4 className="text-sm font-semibold text-ink">Motivo da consultoria</h4>
      <p className="mt-1 whitespace-pre-wrap break-words text-sm text-ink-soft">
        {reason}
      </p>
    </section>
  );
}
