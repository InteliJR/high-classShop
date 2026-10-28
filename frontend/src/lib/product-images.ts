import type { Product, UserProps } from "../types/types";

export function getProductImageUrls(product: Pick<Product, "images" | "imageUrl">): string[] {
  const images = product.images?.filter((image) => image.image_url?.trim()) ?? [];
  const ordered = [
    ...images.filter((image) => image.is_primary),
    ...images.filter((image) => !image.is_primary),
  ].map((image) => image.image_url.trim());

  return ordered.length ? ordered : product.imageUrl?.trim() ? [product.imageUrl.trim()] : [];
}

export function canManageProductImages(
  product: Pick<Product, "specialist_id">,
  user: Pick<UserProps, "id" | "role"> | null,
): boolean {
  return user?.role === "ADMIN" ||
    (user?.role === "SPECIALIST" && user.id === product.specialist_id);
}
