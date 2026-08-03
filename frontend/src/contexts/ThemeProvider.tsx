import type React from "react";
import { useLayoutEffect } from "react";
import { useAuth } from "../store/authStateManager";
import { useWhitelabel } from "../store/whitelabelStore";
import { getBrandColors, getUserCompany } from "../utils/branding";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const user = useAuth((state) => state.user);
  const whitelabel = useWhitelabel((state) => state.company);
  // Usuário logado tem prioridade; visitante anônimo em /i/:slug usa o whitelabel.
  const company = getUserCompany(user) ?? whitelabel;
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
