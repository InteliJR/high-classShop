import { useContext, useEffect } from "react";
import { AuthContext } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";

export default function ProtectedRoute({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useContext(AuthContext);
  const navigate = useNavigate();

  // Gerenciador da lógica de redirecionar a página
  useEffect(() => {
    if (!user && !loading) {
      navigate("/login");
    }
  }, [loading, user]);

  // Indicar visualmente que está carregando a página
  if (loading) {
    return <div>Carregando...</div>;
  }
  // Indicar visualmente que está redirecionando a página
  if (!user && !loading) {
    return <div>Redirecionando...</div>;
  }

  // Retorna a página normalmente caso o usuário exista e não esteja carregando
  return children;
}
