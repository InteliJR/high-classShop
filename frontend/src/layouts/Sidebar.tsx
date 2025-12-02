import { TextAlignJustifyIcon, LayoutDashboard, Building2, Users, UserCog } from "lucide-react";
import { useContext } from "react";
import { AppContext } from "../contexts/AppContext";
import Logo from "../assets/logo_brokerage.png";
import { useIsMobile } from "../hooks/use-is-mobile";
import { Link, useLocation } from "react-router-dom";

export default function Sidebar() {
  const { isSidebarCollapsed, setSidebarCollapsed } = useContext(AppContext);
  const isMobile = useIsMobile();
  const location = useLocation();
  return (
    // Sidebar com controle de caso ela esteja colapsada
    <aside
      className={`
    ${
      isMobile
        ? isSidebarCollapsed
          ? "translate-x-0 opacity-100"
          : "-translate-x-full opacity-0"
        : "translate-x-0 opacity-100"
    }
    ${isMobile ? "w-2/5 fixed h-full" : "w-64  min-h-screen"}
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
            {/* Fechar a sidebar em mobiles*/}
            <TextAlignJustifyIcon size={27} />
          </button>
        </div>
      )}

      <div className="w-2/3 flex justify-center items-center mx-auto">
        <img src={Logo} className="" />
      </div>

      {/* Botões navegáveis */}
      <nav className="px-6 flex flex-col gap-4 text-sm mt-8">
        {/* Dashboard */}
        <Link
          to="/admin/dashboard"
          className={`w-full flex gap-3 items-center p-3 rounded-md transition-colors ${
            location.pathname === '/admin/dashboard'
              ? 'bg-white/20 text-white'
              : 'text-gray-300 hover:bg-white/10 hover:text-white'
          }`}
        >
          <LayoutDashboard size={20} />
          <p>Dashboard</p>
        </Link>

        {/* Companies */}
        <Link
          to="/admin/companies"
          className={`w-full flex gap-3 items-center p-3 rounded-md transition-colors ${
            location.pathname === '/admin/companies'
              ? 'bg-white/20 text-white'
              : 'text-gray-300 hover:bg-white/10 hover:text-white'
          }`}
        >
          <Building2 size={20} />
          <p>Companies</p>
        </Link>

        {/* Consultants */}
        <Link
          to="/admin/consultants"
          className={`w-full flex gap-3 items-center p-3 rounded-md transition-colors ${
            location.pathname === '/admin/consultants'
              ? 'bg-white/20 text-white'
              : 'text-gray-300 hover:bg-white/10 hover:text-white'
          }`}
        >
          <Users size={20} />
          <p>Consultants</p>
        </Link>

        {/* Specialists */}
        <Link
          to="/admin/specialists"
          className={`w-full flex gap-3 items-center p-3 rounded-md transition-colors ${
            location.pathname === '/admin/specialists'
              ? 'bg-white/20 text-white'
              : 'text-gray-300 hover:bg-white/10 hover:text-white'
          }`}
        >
          <UserCog size={20} />
          <p>Specialists</p>
        </Link>
      </nav>
    </aside>
  );
}
