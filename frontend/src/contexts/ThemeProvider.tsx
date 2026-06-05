import type React from "react";
import { useLayoutEffect } from "react";
import { useAuth } from "../store/authStateManager";
import { getBrandColors, getUserCompany } from "../utils/branding";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const user = useAuth((state) => state.user);
  const company = getUserCompany(user);
  const { primary, secondary, primaryFg, secondaryFg } = getBrandColors(company);

  useLayoutEffect(() => {
    const root = document.documentElement;

    root.style.setProperty("--brand-primary", primary);
    root.style.setProperty("--brand-secondary", secondary);
    // Cor de texto derivada via WCAG — garante legibilidade independente da
    // escolha do escritório no whitelabel.
    root.style.setProperty("--brand-primary-fg", primaryFg);
    root.style.setProperty("--brand-secondary-fg", secondaryFg);
  }, [primary, secondary, primaryFg, secondaryFg]);

  return <>{children}</>;
}
