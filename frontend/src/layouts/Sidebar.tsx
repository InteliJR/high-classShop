import {
  TextAlignJustifyIcon,
  LayoutDashboard,
  Building2,
  Users,
  UserCog,
  Car,
  Ship,
  Plane,
  Package,
  Home,
  FilePen,
  Settings,
  Percent,
  Database,
  Calculator,
  PanelLeft,
  ClipboardList,
  UserPlus,
  LogIn,
  type LucideIcon,
} from "lucide-react";
import { useContext, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import Logo from "../assets/logo_brokerage.png";
import { AppContext } from "../contexts/AppContext";
import { useIsMobile } from "../hooks/use-is-mobile";
import {
  getSidebarLinks,
  type NavigationIcon,
} from "../lib/navigation";
import { useAuth } from "../store/authStateManager";
import { useWhitelabel } from "../store/whitelabelStore";
import { getActiveCompany, resolveCompanyLogo } from "../utils/branding";
import { getBrandHomeRoute } from "../utils/roleUtils";

const NAVIGATION_ICONS: Record<NavigationIcon, LucideIcon> = {
  home: Home,
  dashboard: LayoutDashboard,
  building: Building2,
  users: Users,
  "user-cog": UserCog,
  car: Car,
  ship: Ship,
  plane: Plane,
  package: Package,
  "file-pen": FilePen,
  settings: Settings,
  percent: Percent,
  database: Database,
  calculator: Calculator,
  "clipboard-list": ClipboardList,
  "user-plus": UserPlus,
  "log-in": LogIn,
};

export default function Sidebar() {
  const {
    isSidebarCollapsed,
    setSidebarCollapsed,
    isSidebarDesktopCollapsed,
    toggleSidebarDesktopCollapsed,
  } = useContext(AppContext);
  const isMobile = useIsMobile();
  const location = useLocation();
  const user = useAuth((state) => state.user);
  const whitelabelCompany = useWhitelabel((state) => state.company);
  const company = getActiveCompany(user, whitelabelCompany);
  const brandLogo = resolveCompanyLogo(company) ?? Logo;
  const brandHomeRoute = getBrandHomeRoute(user?.role);
  const isDesktopCollapsed = !isMobile && isSidebarDesktopCollapsed;
  const links = getSidebarLinks(user?.role);
  const sidebarRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (!isMobile) return;

    if (!isSidebarCollapsed) {
      if (wasOpenRef.current) {
        document.getElementById("sidebar-menu-trigger")?.focus();
      }
      wasOpenRef.current = false;
      return;
    }

    wasOpenRef.current = true;
    closeButtonRef.current?.focus();
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSidebarCollapsed(false);
        return;
      }

      if (event.key !== "Tab") return;

      const focusableElements = Array.from(
        sidebarRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled])',
        ) ?? [],
      );
      const first = focusableElements[0];
      const last = focusableElements.at(-1);

      if (!first || !last) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousBodyOverflow;
    };
  }, [isMobile, isSidebarCollapsed, setSidebarCollapsed]);

  return (
    <>
      {isMobile && isSidebarCollapsed && (
        <div
          className="fixed inset-0 z-40 bg-black/50"
          onClick={() => setSidebarCollapsed(false)}
        />
      )}
      <aside
        ref={sidebarRef}
        id="main-sidebar"
        role={isMobile ? "dialog" : undefined}
        aria-label={isMobile ? "Menu principal" : undefined}
        aria-modal={isMobile && isSidebarCollapsed ? true : undefined}
        aria-hidden={isMobile && !isSidebarCollapsed ? true : undefined}
        inert={isMobile && !isSidebarCollapsed ? true : undefined}
        className={`
          ${
            isMobile
              ? isSidebarCollapsed
                ? "translate-x-0 opacity-100"
                : "-translate-x-full opacity-0"
              : "translate-x-0 opacity-100"
          }
          ${
            isMobile
              ? "w-72 max-w-[85vw] fixed h-full overflow-y-auto"
              : isDesktopCollapsed
                ? "w-16 min-h-screen"
                : "w-64 min-h-screen"
          }
          top-0 left-0 ease-out z-50 fixed text-brand-secondary-fg
          ${
            isMobile
              ? "transition-normal duration-300"
              : "transition-[width] duration-200"
          }
        `}
        style={{ backgroundColor: "var(--brand-secondary)" }}
      >
        {/* Botão para esconder a sidebar (mobile) */}
        {isMobile && (
          <div className="flex flex-col">
            <button
              ref={closeButtonRef}
              type="button"
              aria-label="Fechar menu"
              className="p-4 self-end"
              onClick={() => setSidebarCollapsed(!isSidebarCollapsed)}
            >
              <TextAlignJustifyIcon size={27} />
            </button>
          </div>
        )}

        {/* Botão de colapsar sidebar (desktop) */}
        {!isMobile && (
          <div
            className={`flex p-3 ${
              isDesktopCollapsed ? "justify-center" : "justify-end"
            }`}
          >
            <button
              onClick={toggleSidebarDesktopCollapsed}
              aria-label={
                isDesktopCollapsed ? "Expandir menu" : "Recolher menu"
              }
              title={isDesktopCollapsed ? "Expandir menu" : undefined}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-brand-secondary-fg/60 transition-colors hover:bg-brand-secondary-fg/10 hover:text-brand-secondary-fg"
            >
              <PanelLeft size={18} />
            </button>
          </div>
        )}

        {!isDesktopCollapsed && (
          <Link
            to={brandHomeRoute}
            aria-label={user ? "Ir para o início" : "Ir para o catálogo de carros"}
            onClick={() => {
              if (isMobile) setSidebarCollapsed(false);
            }}
            className="w-2/3 flex justify-center items-center mx-auto"
          >
            <img
              src={brandLogo}
              alt={company?.name ?? "BMF Lux Brokerage"}
              className="max-h-24 w-auto object-contain"
            />
          </Link>
        )}

        {/* Botões navegáveis */}
        <nav
          className={`flex flex-col gap-4 text-sm mt-8 ${
            isDesktopCollapsed ? "px-2 items-center" : "px-6"
          }`}
        >
          {links.map((link) => {
            const Icon = NAVIGATION_ICONS[link.icon];

            return (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => {
                  if (isMobile) setSidebarCollapsed(false);
                }}
                title={isDesktopCollapsed ? link.label : undefined}
                className={`w-full flex gap-3 items-center p-3 rounded-md transition-colors ${
                  isDesktopCollapsed ? "justify-center px-2" : ""
                } ${
                  location.pathname === link.to
                    ? "text-brand-primary-fg"
                    : "text-gray-300 hover:bg-white/10 hover:text-brand-secondary-fg"
                }`}
                style={
                  location.pathname === link.to
                    ? { backgroundColor: "var(--brand-primary)" }
                    : undefined
                }
              >
                <Icon size={20} />
                {!isDesktopCollapsed && <p>{link.label}</p>}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
