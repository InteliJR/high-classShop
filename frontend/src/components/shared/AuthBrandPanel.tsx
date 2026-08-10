import PlatformLogo from "../../assets/logo_brokerage.png";
import { useAuth } from "../../store/authStateManager";
import { useWhitelabel } from "../../store/whitelabelStore";
import { getUserCompany, resolveCompanyLogo, PLATFORM_NAME } from "../../utils/branding";
import { cn } from "../../lib/utils";

// Painel lateral das telas de autenticação: logo da plataforma ou, em
// whitelabel, a do escritório vigente — mesma resolução usada no Header.
export default function AuthBrandPanel({ className }: { className?: string }) {
  const user = useAuth((s) => s.user);
  const whitelabelCompany = useWhitelabel((s) => s.company);
  const company = getUserCompany(user) ?? whitelabelCompany;
  const logo = resolveCompanyLogo(company) ?? PlatformLogo;

  return (
    <div
      className={cn(
        "flex items-center justify-center bg-brand-primary p-8",
        className,
      )}
    >
      <img
        src={logo}
        alt={company?.name ?? PLATFORM_NAME}
        className="w-full max-w-[220px] sm:max-w-[280px] h-auto object-contain"
      />
    </div>
  );
}
