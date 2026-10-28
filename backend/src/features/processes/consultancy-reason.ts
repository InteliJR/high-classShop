const AUTOMATIC_NOTES = new Set([
  'Consultoria solicitada pelo cliente',
  'Cliente solicitou reunião por e-mail',
  'Cliente acessou link do Calendly',
]);

const CREATED_ON_BEHALF_NOTE = new RegExp(
  '^Consultoria criada pelo (?:consultor|gerente do escritório) ' +
    'em nome do cliente ' +
    '\\(\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z\\)$',
  'u',
);

/** The appointment keeps its original consultancy scope after a product is assigned. */
export function getConsultancyReason(
  appointment?: {
    product_type?: string | null;
    product_id?: string | null;
    notes?: string | null;
  } | null,
): string | null {
  if (
    !appointment ||
    appointment.product_type !== null ||
    appointment.product_id !== null
  ) {
    return null;
  }
  const reason = appointment.notes?.trim();
  // Match complete generated notes, not prefixes that a customer may also use.
  if (
    !reason ||
    AUTOMATIC_NOTES.has(reason) ||
    CREATED_ON_BEHALF_NOTE.test(reason)
  ) {
    return null;
  }
  return reason;
}
