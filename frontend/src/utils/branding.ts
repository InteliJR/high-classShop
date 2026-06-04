import type { CompanyBranding, UserProps } from "../types/types";

export const DEFAULT_BRAND_PRIMARY = "#3C3C3C";
export const DEFAULT_BRAND_SECONDARY = "#1C1C1C";

export function getUserCompany(user: UserProps | null): CompanyBranding | null {
  return user?.company ?? user?.consultant?.company ?? null;
}

export function getBrandColors(company: CompanyBranding | null) {
  return {
    primary:
      company?.primary_color ?? company?.color_identity?.[0] ?? DEFAULT_BRAND_PRIMARY,
    secondary:
      company?.secondary_color ??
      company?.color_identity?.[1] ??
      DEFAULT_BRAND_SECONDARY,
  };
}

export function getLogoSource(logo?: string | null): string | null {
  if (!logo) return null;

  if (
    logo.startsWith("http://") ||
    logo.startsWith("https://") ||
    logo.startsWith("data:") ||
    logo.startsWith("/")
  ) {
    return logo;
  }

  return `data:image/png;base64,${logo}`;
}
