export function isCalendlySchedulingAvailable(input: {
  calendlyUrl: string | null;
  connectionActive: boolean;
}): boolean {
  if (!input.connectionActive || !input.calendlyUrl) return false;

  try {
    const url = new URL(input.calendlyUrl);
    const host = url.hostname.toLowerCase();
    return (
      url.protocol === 'https:' &&
      (host === 'calendly.com' || host.endsWith('.calendly.com'))
    );
  } catch {
    return false;
  }
}
