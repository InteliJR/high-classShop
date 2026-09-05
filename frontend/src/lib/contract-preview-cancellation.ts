export async function cancelPreviewBeforeDiscard(
  cancelPreview: () => Promise<void>,
  discardPreview: () => void,
): Promise<void> {
  await cancelPreview();
  discardPreview();
}

export async function expirePreviewBeforeDiscard(
  cancelPreview: () => Promise<void>,
  discardPreview: () => void,
  markExpired: () => void,
): Promise<void> {
  await cancelPreviewBeforeDiscard(cancelPreview, () => {
    discardPreview();
    markExpired();
  });
}

export function shouldRequestPreviewExpiration(
  isBusy: boolean,
  expirationAlreadyRequested: boolean,
): boolean {
  return !isBusy && !expirationAlreadyRequested;
}
