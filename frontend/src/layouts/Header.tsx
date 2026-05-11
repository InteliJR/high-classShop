import { ChevronDown, TextAlignJustifyIcon, UserCircle2 } from "lucide-react";
import Logo from "../assets/logo_brokerage.png";
import { useContext } from "react";
import { useIsMobile } from "../hooks/use-is-mobile";
import { useAuth } from "../store/authStateManager";
import { AppContext } from "../contexts/AppContext";
import { useNavigate } from "react-router-dom";
import UserDropdown from "../components/ui/UserDropdown";

export default function Header() {
  const { isSidebarCollapsed, setSidebarCollapsed } = useContext(AppContext);
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const navigate = useNavigate();

  // Lista de itens do menu para visitantes
  const menuItems = [
    { label: "Aeronaves", path: "/catalog/aircrafts" },
    { label: "Embarcações", path: "/catalog/boats" },
    { label: "Carros", path: "/catalog/cars" },
  ];

  return (
    <>
      <header
        className={`w-full sticky flex h-24 bg-background-secondary text-white z-50
          justify-end items-center px-6 sm:px-18 ${
            !isMobile && !isSidebarCollapsed && ""
          }`}
      >
        <div className="flex w-full justify-between sm:flex-row-reverse items-center">
          {isMobile && (
            // Abrir a sidebar do header em mobiles
            <TextAlignJustifyIcon
              size={35}
              onClick={() => {
                setSidebarCollapsed(!isSidebarCollapsed);
              }}
            />
          )}
          {!isMobile && !user && (
            <div className="flex justify-between items-center text-base w-full pl-12">
              {/* Navegação nos links */}
              <nav>
                <ul className="flex gap-2">
                  {menuItems.map((item) => (
                    <li
                      key={item.path}
                      className="flex items-center p-2 gap-0.5 cursor-pointer"
                      onClick={() => navigate(item.path)}
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
            <div className="flex items-center w-full justify-end">
              <div className="ml-2 mr-2 sm:mr-4 shrink-0">
                <UserDropdown />
              </div>
            </div>
          ) : (
            <img src={Logo} className="w-25 sm:w-35 h-auto" />
          )}
        </div>
      </header>
    </>
  );
}
