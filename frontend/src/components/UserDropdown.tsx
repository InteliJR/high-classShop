import { useState, useRef, useEffect, useContext } from "react";
import { UserCircle2, Settings, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../store/authStateManager";
import { AuthContext } from "../contexts/AuthContext";

/**
 * UserDropdown Component
 *
 * Exibe um ícone de usuário no canto superior direito.
 * Ao clicar, abre um dropdown com:
 * - Nome do usuário e cargo
 * - Botão para Configurações (editar perfil)
 * - Botão para Sair (logout)
 */
export default function UserDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const { logout } = useContext(AuthContext);
  const navigate = useNavigate();

  // Fecha o dropdown quando clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Tradução do cargo para português
  const roleLabels: Record<string, string> = {
    CUSTOMER: "Cliente",
    CONSULTANT: "Consultor",
    SPECIALIST: "Especialista",
    ADMIN: "Administrador",
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (err) {
      console.log("Erro ao deslogar:", err);
    } finally {
      navigate("/login");
    }
  };

  const handleSettings = () => {
    setIsOpen(false);
    navigate("/profile");
  };

  if (!user) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Botão do ícone de usuário */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-full hover:bg-white/10 transition-colors focus:outline-none"
        aria-label="Menu do usuário"
      >
        <UserCircle2 size={40} className="text-white" />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-xl border border-gray-200 py-2 z-50">
          {/* Informações do usuário */}
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="font-semibold text-gray-900 text-lg">
              {user.name} {user.surname}
            </p>
            <p className="text-sm text-gray-500">
              {roleLabels[user.role] || user.role}
            </p>
          </div>

          {/* Opções */}
          <div className="py-1">
            {/* Botão Configurações */}
            <button
              onClick={handleSettings}
              className="w-full flex items-center gap-3 px-4 py-2 text-gray-700 hover:bg-gray-100 transition-colors"
            >
              <Settings size={18} />
              <span>Configurações</span>
            </button>

            {/* Botão Sair */}
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-2 text-red-600 hover:bg-red-50 transition-colors"
            >
              <LogOut size={18} />
              <span>Sair</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
