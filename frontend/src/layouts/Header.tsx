import { ChevronDown, TextAlignJustifyIcon, UserCircle2 } from "lucide-react";
import Logo from "../assets/logo_brokerage.png";
import { useContext, useEffect } from "react";
import { useIsMobile } from "../hooks/use-is-mobile";
import { useAuth } from "../store/authStateManager";
import { AppContext } from "../contexts/AppContext";
import { Link, useNavigate } from "react-router-dom";
import UserDropdown from "../components/ui/UserDropdown";
import { getActiveCompany, resolveCompanyLogo } from "../utils/branding";
import { useWhitelabel } from "../store/whitelabelStore";
import { getBrandHomeRoute } from "../utils/roleUtils";
import { PUBLIC_CATALOG_LINKS } from "../lib/navigation";

export default function Header() {
  const { isSidebarCollapsed, setSidebarCollapsed } = useContext(AppContext);
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const navigate = useNavigate();
  const whitelabelCompany = useWhitelabel((s) => s.company);
  const company = getActiveCompany(user, whitelabelCompany);
  const brandLogo = resolveCompanyLogo(company) ?? Logo;
  const brandHomeRoute = getBrandHomeRoute(user?.role);

  useEffect(() => {
    if (!isMobile && isSidebarCollapsed) {
      setSidebarCollapsed(false);
    }
  }, [isMobile, isSidebarCollapsed, setSidebarCollapsed]);

  return (
    <>
      <header
        className={`w-full sticky flex h-24 text-brand-primary-fg z-50
          justify-end items-center px-6 sm:px-18 ${
            !isMobile && !isSidebarCollapsed && ""
          }`}
        style={{ backgroundColor: "var(--brand-primary)" }}
      >
        <div className="flex w-full justify-between sm:flex-row-reverse items-center">
          {isMobile && (
            <button
              id="sidebar-menu-trigger"
              type="button"
              aria-label={isSidebarCollapsed ? "Fechar menu" : "Abrir menu"}
              aria-expanded={isSidebarCollapsed}
              aria-controls="main-sidebar"
              onClick={() => {
                setSidebarCollapsed(!isSidebarCollapsed);
              }}
              className="flex items-center justify-center"
            >
              <TextAlignJustifyIcon size={35} />
            </button>
          )}
          {!isMobile && !user && (
            <div className="flex justify-between items-center text-base w-full pl-12">
              {/* Navegação nos links */}
              <nav>
                <ul className="flex gap-2">
                  {PUBLIC_CATALOG_LINKS.map((item) => (
                    <li
                      key={item.to}
                      className="flex items-center p-2 gap-0.5 cursor-pointer"
                      onClick={() => navigate(item.to)}
                    >
                      <span>{item.label}</span>
                      <ChevronDown size={20} />
                    </li>
                  ))}
                </ul>
              </nav>

              {/* BOTÕES LOGIN E CADASTRAR */}
              <div className="flex gap-2">
                <button
                  onClick={() => navigate("/register")}
                  className="flex p-2 gap-2 bg-transparent border border-white text-white rounded-md cursor-pointer hover:bg-white/10 transition-colors"
                >
                  Cadastrar-se
                </button>
                <button
                  onClick={() => navigate("/login")}
                  className="flex p-2 gap-3 bg-white text-black rounded-md cursor-pointer"
                >
                  <UserCircle2 size={25} />
                  Login
                </button>
              </div>
            </div>
          )}

          {user ? (
            <div className="flex items-center w-full justify-between">
              <Link
                to={brandHomeRoute}
                className="cursor-pointer"
                aria-label="Ir para o início"
              >
                <img
                  src={brandLogo}
                  alt={company?.name ?? "BMF Lux Brokerage"}
                  className="max-h-14 w-auto max-w-36 object-contain"
                />
              </Link>
              <div className="ml-2 mr-2 sm:mr-4 shrink-0">
                <UserDropdown />
              </div>
            </div>
          ) : (
            <Link
              to={brandHomeRoute}
              className="cursor-pointer"
              aria-label="Ir para o catálogo de carros"
            >
              <img
                src={brandLogo}
                alt={company?.name ?? "BMF Lux Brokerage"}
                className="w-25 sm:w-35 h-auto"
              />
            </Link>
          )}
        </div>
      </header>
    </>
  );
}
