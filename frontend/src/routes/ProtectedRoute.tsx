import { useContext, useEffect } from "react";
import { AuthContext } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../store/authStateManager";
import type { UserRole } from "../types/types";

export default function ProtectedRoute({
  children,
  allowedRoles,
}: {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}) {
  const { loading } = useContext(AuthContext);
  const user = useAuth((state) => state.user);
  const navigate = useNavigate();

  // Gerenciador da lógica de redirecionar a página
  useEffect(() => {
    if (!user && !loading) {
      navigate("/login");
    }
    // Verificar se o usuário tem permissão para acessar a rota
    if (user && !loading && allowedRoles && !allowedRoles.includes(user.role)) {
      navigate("/catalog/cars");
    }
  }, [loading, user, allowedRoles, navigate]);

  // Indicar visualmente que está carregando a página
  if (loading) {
    return <div>Carregando...</div>;
  }
  // Indicar visualmente que está redirecionando a página
  if (!user && !loading) {
    return <div>Redirecionando...</div>;
  }
  // Verificar se o usuário tem permissão para acessar a rota
  if (user && allowedRoles && !allowedRoles.includes(user.role)) {
    return <div>Acesso negado...</div>;
  }

  // Retorna a página normalmente caso o usuário exista e não esteja carregando
  return children;
}
