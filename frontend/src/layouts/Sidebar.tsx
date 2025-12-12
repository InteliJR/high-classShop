import {
  TextAlignJustifyIcon,
  LayoutDashboard,
  Building2,
  Users,
  UserCog,
  Car,
  Ship,
  Plane,
  Home,
} from "lucide-react";
import { useContext } from "react";
import { AppContext } from "../contexts/AppContext";
import Logo from "../assets/logo_brokerage.png";
import { useIsMobile } from "../hooks/use-is-mobile";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../store/authStateManager";

export default function Sidebar() {
  const { isSidebarCollapsed, setSidebarCollapsed } = useContext(AppContext);
  const isMobile = useIsMobile();
  const location = useLocation();
  const user = useAuth((state) => state.user);

  // Lista de links por cargo
  const links = [];

  if (user) {
    switch (user.role) {
      case "CUSTOMER":
        links.push(
          {
            to: "/customer/home",
            label: "Home",
            icon: <Home size={20} />,
          },
          {
            to: "/customer/consultoria",
            label: "Consultoria",
            icon: <Users size={20} />,
          },
          {
            to: "/catalog/cars",
            label: "Carros",
            icon: <Car size={20} />,
          },
          {
            to: "/catalog/boats",
            label: "Embarcações",
            icon: <Ship size={20} />,
          },
          {
            to: "/catalog/aircrafts",
            label: "Aviões",
            icon: <Plane size={20} />,
          }
        );
        break;
      case "CONSULTANT":
        links.push({
          to: "/consultant/dashboard",
          label: "Dashboard",
          icon: <LayoutDashboard size={20} />,
        });
        break;
      case "SPECIALIST":
        links.push({
          to: "/specialist/dashboard",
          label: "Dashboard",
          icon: <LayoutDashboard size={20} />,
        });
        break;
      case "ADMIN":
        links.push(
          {
            to: "/admin/dashboard",
            label: "Dashboard",
            icon: <LayoutDashboard size={20} />,
          },
          {
            to: "/admin/companies",
            label: "Empresas",
            icon: <Building2 size={20} />,
          },
          {
            to: "/admin/consultants",
            label: "Consultores",
            icon: <Users size={20} />,
          },
          {
            to: "/admin/specialists",
            label: "Especialistas",
            icon: <UserCog size={20} />,
          }
        );
        break;
    }
  }

  return (
    <aside
      className={`
        ${
          isMobile
            ? isSidebarCollapsed
              ? "translate-x-0 opacity-100"
              : "-translate-x-full opacity-0"
            : "translate-x-0 opacity-100"
        }
        ${isMobile ? "w-2/5 fixed h-full" : "w-64 min-h-screen"}
        top-0 left-0 transition-normal ease-out duration-300 z-50 fixed bg-black text-white
      `}
    >
      {/* Botão para esconder a sidebar */}
      {isMobile && (
        <div className="flex flex-col">
          <button
            className="p-4 self-end"
            onClick={() => setSidebarCollapsed(!isSidebarCollapsed)}
          >
            <TextAlignJustifyIcon size={27} />
          </button>
        </div>
      )}

      <div className="w-2/3 flex justify-center items-center mx-auto">
        <img src={Logo} className="" />
      </div>

      {/* Botões navegáveis */}
      <nav className="px-6 flex flex-col gap-4 text-sm mt-8">
        {links.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className={`w-full flex gap-3 items-center p-3 rounded-md transition-colors ${
              location.pathname === link.to
                ? ""
                : "text-gray-300 hover:bg-white/10 hover:text-white"
            }`}
          >
            {link.icon}
            <p>{link.label}</p>
          </Link>
        ))}
      </nav>
    </aside>
  );
}
