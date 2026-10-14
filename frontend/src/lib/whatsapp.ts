export function buildWhatsAppHref(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  const normalized = /^\d{10,11}$/.test(digits)
    ? `55${digits}`
    : /^55\d{10,11}$/.test(digits) ? digits : null;
  return normalized ? `https://wa.me/${normalized}` : null;
}
