import type React from "react";
import { useLayoutEffect } from "react";
import { useAuth } from "../store/authStateManager";
import { useWhitelabel } from "../store/whitelabelStore";
import {
  PLATFORM_NAME,
  getBrandColors,
  getUserCompany,
  resolveCompanyLogo,
} from "../utils/branding";

const PLATFORM_FAVICON = "/favicon.png";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const user = useAuth((state) => state.user);
  const whitelabel = useWhitelabel((state) => state.company);
  // Usuário logado tem prioridade; visitante anônimo em /i/:slug usa o whitelabel.
  const company = getUserCompany(user) ?? whitelabel;
  const { primary, secondary, primaryFg, secondaryFg } = getBrandColors(company);
  const brandLogo = resolveCompanyLogo(company);

  useLayoutEffect(() => {
    const root = document.documentElement;

    root.style.setProperty("--brand-primary", primary);
    root.style.setProperty("--brand-secondary", secondary);
    // Cor de texto derivada via WCAG — garante legibilidade independente da
    // escolha do escritório no whitelabel.
    root.style.setProperty("--brand-primary-fg", primaryFg);
    root.style.setProperty("--brand-secondary-fg", secondaryFg);
  }, [primary, secondary, primaryFg, secondaryFg]);

  // A aba acompanha a mesma marca que o resto da tela.
  useLayoutEffect(() => {
    document.title = company?.name ?? PLATFORM_NAME;
  }, [company?.name]);

  // ponytail: o logo do escritório é URL assinada do S3 (expira em 1h) e um
  // favicon quebrado não tem fallback no browser — por isso só trocamos o href
  // depois que a imagem carrega de fato, e voltamos pro da plataforma se falhar.
  useLayoutEffect(() => {
    const link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
    if (!link) return;
    if (!brandLogo) {
      link.type = "image/png";
      link.href = PLATFORM_FAVICON;
      return;
    }

    const probe = new Image();
    probe.onload = () => {
      // O logo do escritório pode ser jpg/webp — deixar o type=image/png faria
      // o Chrome descartar o ícone.
      link.removeAttribute("type");
      link.href = brandLogo;
    };
    probe.onerror = () => {
      link.href = PLATFORM_FAVICON;
    };
    probe.src = brandLogo;

    return () => {
      probe.onload = null;
      probe.onerror = null;
    };
  }, [brandLogo]);

  return <>{children}</>;
}
