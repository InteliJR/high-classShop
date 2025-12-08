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

  // Função que define para onde o usuário deve ser redirecionado
  const redirectByRole = (role: UserRole) => {
    switch (role) {
      case "CUSTOMER":
        return "/catalog/cars";
      case "CONSULTANT":
        return "/consultant/dashboard";
      case "SPECIALIST":
        return "/specialist/dashboard";
      case "ADMIN":
        return "/admin/dashboard";
      default:
        return "/login";
    }
  };

  useEffect(() => {
    if (!loading) {
      // Usuário não está logado
      if (!user) {
        navigate("/login");
        return;
      }

      // Usuário logado mas não tem permissão
      if (allowedRoles && !allowedRoles.includes(user.role)) {
        navigate(redirectByRole(user.role));
      }
    }
  }, [loading, user, allowedRoles, navigate]);

  // Tela de carregamento
  if (loading) {
    return <div>Carregando...</div>;
  }

  // Ainda sem usuário (após loading) → já está redirecionando, mostrar visual
  if (!user) {
    return <div>Redirecionando...</div>;
  }

  // Se não tem permissão, não renderiza nada (o useEffect já redirecionou)
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return null;
  }

  return children;
}
