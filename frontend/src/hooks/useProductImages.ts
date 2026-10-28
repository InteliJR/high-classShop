import { useState } from "react";

export function useProductImages(imageUrls: string[], showImageErrors: boolean) {
  const [failedUrls, setFailedUrls] = useState<Set<string>>(() => new Set());
  const markFailed = (url: string) => {
    setFailedUrls((previous) => previous.has(url) ? previous : new Set([...previous, url]));
  };

  return {
    imageUrls: imageUrls.filter((url) => url.trim() && (showImageErrors || !failedUrls.has(url))),
    failedUrls,
    markFailed,
  };
}
