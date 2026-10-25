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
  return appointment.notes?.trim() || null;
}
