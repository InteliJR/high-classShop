// ponytail: aspas literais em env vars são um erro comum de config (Railway/.env
// não fazem parsing de shell) — strip defensivo pra não virar CORS silencioso em prod.
export function stripEnvQuotes(value: string): string {
  return value.trim().replace(/^(['"])(.*)\1$/, '$2');
}

export function getFrontendUrl(): string {
  const value = stripEnvQuotes(process.env.FRONTEND_URL || 'http://localhost:5173');
  return value.replace(/\/+$/, '');
}
