import type { CompanyBranding, UserProps } from "../types/types";
import { pickReadableText } from "./contrast";

export const DEFAULT_BRAND_PRIMARY = "#3C3C3C";
export const DEFAULT_BRAND_SECONDARY = "#1C1C1C";

export function getUserCompany(user: UserProps | null): CompanyBranding | null {
  return user?.company ?? user?.consultant?.company ?? null;
}

export function getBrandColors(company: CompanyBranding | null) {
  const primary =
    company?.primary_color ?? company?.color_identity?.[0] ?? DEFAULT_BRAND_PRIMARY;
  const secondary =
    company?.secondary_color ??
    company?.color_identity?.[1] ??
    DEFAULT_BRAND_SECONDARY;

  // Cor de texto computada por contraste WCAG para garantir legibilidade
  // mesmo quando o escritório escolhe uma cor de fundo arbitrária.
  return {
    primary,
    secondary,
    primaryFg: pickReadableText(primary),
    secondaryFg: pickReadableText(secondary),
  };
}

export function getLogoSource(logo?: string | null): string | null {
  if (!logo) return null;

  // Logos novos vivem no S3; a URL assinada chega no campo `logoUrl`.
  // Quando só temos a key, devolvemos null e quem chama deve preferir logoUrl.
  if (logo.startsWith("companies/")) return null;

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

// Resolve a melhor URL pra exibir um logo: prioriza logoUrl (signed S3) e cai
// no fallback de `logo` (legados em base64) preservando compatibilidade.
export function resolveCompanyLogo(
  branding?: { logoUrl?: string | null; logo?: string | null } | null,
): string | null {
  if (!branding) return null;
  return branding.logoUrl ?? getLogoSource(branding.logo);
}
