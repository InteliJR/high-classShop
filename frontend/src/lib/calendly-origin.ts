/**
 * Accepts only Calendly's HTTPS origin family. Hostname boundary checks avoid
 * lookalikes such as `evilcalendly.com` and `calendly.com.evil.test`.
 */
export function isTrustedCalendlyOrigin(value: string): boolean {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();

    return (
      url.protocol === "https:" &&
      url.port === "" &&
      (hostname === "calendly.com" || hostname.endsWith(".calendly.com"))
    );
  } catch {
    return false;
  }
}
