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
import { useSearch } from "../contexts/SearchContext";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../contexts/AuthContext";

export default function Header() {
  const { isSidebarCollapsed, setSidebarCollapsed } = useContext(AppContext);
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const { searchTerm, setSearchTerm } = useSearch();
  const { logout } = useContext(AuthContext);
  const navigate = useNavigate();

  return (
    <>
      <header
        className={`w-full sticky flex h-24 bg-background-secondary text-white
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
                  <li className="flex items-center p-2 gap-0.5">
                    <a>Sobre nós</a>
                    <ChevronDown size={20} />
                  </li>
                  <li className="flex items-center p-2 gap-0.5">
                    <a>Aeronave</a>
                    <ChevronDown size={20} />
                  </li>
                  <li className="flex items-center p-2 gap-0.5">
                    <a>Barco</a>
                    <ChevronDown size={20} />
                  </li>
                  <li className="flex items-center p-2 gap-0.5">
                    <a>Carro</a>
                    <ChevronDown size={20} />
                  </li>
                </ul>
              </nav>
              <button className="flex p-2 gap-3 bg-white text-black rounded-md">
                <UserCircle2 size={25} />
                Login
              </button>
            </div>
          )}

          {/* Barra de pesquisa para quando tiver um usuário logado */}
          {user ? (
            <div className="flex sm:justify-around sm:w-full">
              {/* Mostra a barra de pesquisa apenas se NÃO estiver na dashboard */}

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

              <button
                onClick={async () => {
                  await logout(); // limpa user e accessToken
                  navigate("/login"); // redireciona para a tela de login
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
