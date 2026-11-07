/**
 * ID da pasta do Google Drive a partir do link (`/folders/<id>` ou `?id=<id>`)
 * ou do próprio ID. `null` quando não é nenhum dos dois.
 *
 * Variações do mesmo link (`?usp=sharing`, `/u/0/`) dão o mesmo ID.
 */
export function extractDriveFolderId(urlOrId: string): string | null {
  const trimmed = urlOrId.trim();
  const fromFolderPath = trimmed.match(/\/folders\/([a-zA-Z0-9_-]{10,})/)?.[1];
  if (fromFolderPath) return fromFolderPath;

  const fromQuery = trimmed.match(/[?&]id=([a-zA-Z0-9_-]{10,})/)?.[1];
  if (fromQuery) return fromQuery;

  return /^[a-zA-Z0-9_-]{10,}$/.test(trimmed) ? trimmed : null;
}
