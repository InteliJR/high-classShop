import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../store/authStateManager";
import ProductsPage from "./ProductsPage";

export default function SpecialistDashboard() {
  const user = useAuth((state) => state.user);
  const navigate = useNavigate();

  useEffect(() => {
    // Se o usuário não tem especialidade definida, redireciona para o catálogo
    if (!user?.speciality) {
      navigate("/catalog/cars");
    }
  }, [user, navigate]);

  if (!user?.speciality) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  // Renderiza diretamente a página de produtos (que já tem a listagem e o botão de adicionar)
  return <ProductsPage />;
}

