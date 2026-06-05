/**
 * Utilidades de contraste WCAG 2.1.
 *
 * Usadas para derivar a cor de texto legível (branco ou preto) sobre uma cor
 * de fundo arbitrária escolhida pelo escritório no whitelabel.
 */

const HEX_RE = /^#?([0-9a-fA-F]{6})$/;
const READABLE_LIGHT = "#FFFFFF";
const READABLE_DARK = "#111111";

function parseHex(input: string): { r: number; g: number; b: number } | null {
  const m = input.trim().match(HEX_RE);
  if (!m) return null;
  const hex = m[1];
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
  };
}

function srgbToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

// Luminância relativa WCAG. Retorna NaN para entrada inválida.
export function luminance(hex: string): number {
  const rgb = parseHex(hex);
  if (!rgb) return NaN;
  return (
    0.2126 * srgbToLinear(rgb.r) +
    0.7152 * srgbToLinear(rgb.g) +
    0.0722 * srgbToLinear(rgb.b)
  );
}

// Razão de contraste WCAG entre duas cores. Retorna 1 quando alguma é inválida.
export function contrastRatio(a: string, b: string): number {
  const La = luminance(a);
  const Lb = luminance(b);
  if (Number.isNaN(La) || Number.isNaN(Lb)) return 1;
  const hi = Math.max(La, Lb);
  const lo = Math.min(La, Lb);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Escolhe a cor de texto (branco ou quase-preto) com maior contraste contra `bg`.
 * Retorna branco quando o fundo é inválido para falhar de forma segura.
 */
export function pickReadableText(bg: string): string {
  const onLight = contrastRatio(bg, READABLE_LIGHT);
  const onDark = contrastRatio(bg, READABLE_DARK);
  return onLight >= onDark ? READABLE_LIGHT : READABLE_DARK;
}
