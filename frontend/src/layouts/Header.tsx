import {
  ChevronDown,
  Search,
  TextAlignJustifyIcon,
  UserCircle2,
} from "lucide-react";
import Logo from "../assets/logo_brokerage.png";
import { useContext } from "react";
import { useIsMobile } from "../hooks/use-is-mobile";
import { useAuth } from "../store/authStateManager";
import { AppContext } from "../contexts/AppContext";
import { useNavigate, useLocation } from "react-router-dom";
import { AuthContext } from "../contexts/AuthContext";

export default function Header() {
  const { isSidebarCollapsed, setSidebarCollapsed, searchTerm, setSearchTerm } =
    useContext(AppContext);
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const { logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();

  // Mostrar busca em admin (exceto dashboard) e em produtos do especialista (exceto formulários)
  const showSearch =
    (location.pathname.startsWith("/admin") &&
      !location.pathname.includes("/dashboard")) ||
    (location.pathname.startsWith("/specialist/products") &&
      !location.pathname.includes("/new") &&
      !location.pathname.match(/\/specialist\/products\/\d+$/));

  // Lista de itens do menu para visitantes
  const menuItems = [
    { label: "Sobre nós", path: "/catalog/login" }, // Trocar para a landing page posteriormentes
    { label: "Aeronave", path: "/catalog/aircrafts" },
    { label: "Barco", path: "/catalog/boats" },
    { label: "Carro", path: "/catalog/cars" },
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

              {/* BOTÃO LOGIN */}
              <button
                onClick={() => navigate("/login")}
                className="flex p-2 gap-3 bg-white text-black rounded-md cursor-pointer"
              >
                <UserCircle2 size={25} />
                Login
              </button>
            </div>
          )}

          {/* Barra de pesquisa para quando tiver um usuário logado */}
          {user ? (
            <div className="flex sm:justify-around sm:w-full">
              {showSearch && (
                <div className="flex justify-center items-center sm:w-full">
                  <div className="relative flex items-center">
                    <Search
                      size={18}
                      className="absolute translate-x-3 text-black"
                    />
                  </div>
                  <input
                    className=" bg-white rounded-full w-2/3 h-10 text-black px-10"
                    type="text"
                    placeholder="Buscar..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              )}

              <button
                onClick={async () => {
                  try {
                    await logout(); // limpa user e accessToken
                  } catch (err) {
                    console.log("Ocorreu um erro: ", err);
                  } finally {
                    navigate("/login"); // redireciona para a tela de login
                  }
                }}
              >
                <UserCircle2 size={40} />
              </button>
            </div>
          ) : (
            <img src={Logo} className="w-25 sm:w-35 h-auto" />
          )}
        </div>
      </header>
    </>
  );
}
