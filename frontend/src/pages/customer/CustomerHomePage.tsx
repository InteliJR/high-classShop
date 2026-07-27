import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../store/authStateManager";
import { Search, BookOpen, Car, Ship, Plane } from "lucide-react";
import Button from "../../components/ui/button";
import ProductTypePreferenceModal, {
  type PreferredProductType,
} from "../../components/product/ProductTypePreferenceModal";

export default function CustomerHomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [interestModalOpen, setInterestModalOpen] = useState(false);
  const [interestTarget, setInterestTarget] = useState<"catalog" | "consultoria" | null>(null);

  const catalogRouteMap: Record<PreferredProductType, string> = {
    CAR: "/catalog/cars",
    BOAT: "/catalog/boats",
    AIRCRAFT: "/catalog/aircrafts",
  };

  const handleOpenInterestModal = (target: "catalog" | "consultoria") => {
    setInterestTarget(target);
    setInterestModalOpen(true);
  };

  const handleSelectInterest = (type: PreferredProductType) => {
    setInterestModalOpen(false);

    if (interestTarget === "consultoria") {
      navigate(`/customer/consultoria?type=${type}`);
      return;
    }

    navigate(catalogRouteMap[type]);
  };

  return (
    <div className="flex flex-col w-full max-w-6xl mx-auto py-8 px-4">
      {/* Welcome Section */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl sm:text-4xl font-bold text-ink">
          Bem-vindo{user?.name ? `, ${user.name}` : ''}!
        </h1>
        <p className="text-lg text-muted max-w-2xl mx-auto">
          O que você gostaria de fazer hoje? Escolha uma das opções abaixo para começar.
        </p>
      </div>

      {/* Main Options Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
        {/* Explorar Catálogo Card */}
        <div
          onClick={() => handleOpenInterestModal("catalog")}
          className="bg-surface border-2 border-border rounded-2xl p-8 cursor-pointer hover:border-ink hover:shadow-xl transition-all duration-300 group"
        >
          <div className="flex flex-col items-center text-center space-y-6">
            <div className="p-4 bg-ink/10 rounded-full group-hover:bg-ink/20 transition-colors">
              <Search size={48} className="text-ink" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-ink">Explorar o Catálogo</h2>
              <p className="text-muted">
                Navegue por nossa coleção exclusiva de produtos de luxo.
                Encontre carros, embarcações ou aeronaves perfeitos para você.
              </p>
            </div>

            {/* Category Icons */}
            <div className="flex gap-6 pt-4">
              <div className="flex flex-col items-center gap-2 text-muted">
                <Car size={24} />
                <span className="text-xs">Carros</span>
              </div>
              <div className="flex flex-col items-center gap-2 text-muted">
                <Ship size={24} />
                <span className="text-xs">Embarcações</span>
              </div>
              <div className="flex flex-col items-center gap-2 text-muted">
                <Plane size={24} />
                <span className="text-xs">Aeronaves</span>
              </div>
            </div>

            <Button variant="brand" className="mt-4">
              Explorar Agora
            </Button>
          </div>
        </div>

        {/* Pedir Consultoria Card */}
        <div
          onClick={() => handleOpenInterestModal("consultoria")}
          className="bg-surface border-2 border-border rounded-2xl p-8 cursor-pointer hover:border-ink hover:shadow-xl transition-all duration-300 group"
        >
          <div className="flex flex-col items-center text-center space-y-6">
            <div className="p-4 bg-ink/10 rounded-full group-hover:bg-ink/20 transition-colors">
              <BookOpen size={48} className="text-ink" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-ink">Pedir Consultoria</h2>
              <p className="text-muted">
                Agende uma consulta com nossos especialistas.
                Receba orientação personalizada para sua compra.
              </p>
            </div>

            {/* Features */}
            <div className="flex flex-col gap-2 pt-4 text-sm text-muted">
              <p>✓ Especialistas em cada categoria</p>
              <p>✓ Consultoria personalizada</p>
              <p>✓ Agendamento flexível</p>
            </div>

            <Button variant="brand" className="mt-4">
              Agendar Consultoria
            </Button>
          </div>
        </div>
      </div>

      {/* Quick Access to Categories */}
      <div className="mt-12">
        <h3 className="text-xl font-semibold text-ink mb-6 text-center">
          Acesso Rápido às Categorias
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Button
            onClick={() => navigate("/catalog/cars")}
            variant="light"
            className="justify-center gap-3 p-4 rounded-xl"
          >
            <Car size={24} className="text-ink" />
            <span className="font-medium">Carros</span>
          </Button>
          <Button
            onClick={() => navigate("/catalog/boats")}
            variant="light"
            className="justify-center gap-3 p-4 rounded-xl"
          >
            <Ship size={24} className="text-ink" />
            <span className="font-medium">Embarcações</span>
          </Button>
          <Button
            onClick={() => navigate("/catalog/aircrafts")}
            variant="light"
            className="justify-center gap-3 p-4 rounded-xl"
          >
            <Plane size={24} className="text-ink" />
            <span className="font-medium">Aeronaves</span>
          </Button>
        </div>
      </div>

      <ProductTypePreferenceModal
        isOpen={interestModalOpen}
        title="Qual tipo de produto você prefere?"
        description={
          interestTarget === "consultoria"
            ? "Vamos direcionar você para especialistas da categoria escolhida."
            : "Vamos abrir o catálogo da categoria que você quer explorar."
        }
        onClose={() => setInterestModalOpen(false)}
        onSelect={handleSelectInterest}
      />
    </div>
  );
}

