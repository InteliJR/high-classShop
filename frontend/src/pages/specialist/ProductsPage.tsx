import { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { useAuth } from "../../store/authStateManager";
import { AppContext } from "../../contexts/AppContext";
import { getCars, deleteCar } from "../../services/cars.service";
import { getBoats, deleteBoat } from "../../services/boats.service";
import { getAircrafts, deleteAircraft } from "../../services/aircrafts.service";
import type { SpecialityType } from "../../types/types";
import Button from "../../components/ui/button";
import { Alert } from "../../components/ui/alert";
import { Card } from "../../components/ui/card";
import { PageHeader } from "../../components/patterns/PageHeader";
import ResponsiveProductList, {
  type ProductListItem,
} from "../../components/specialist/ResponsiveProductList";

type ProductType = "cars" | "boats" | "aircrafts";

// Mapeia especialidade para tipo de produto
const specialityToProductType: Record<SpecialityType, ProductType> = {
  CAR: "cars",
  BOAT: "boats",
  AIRCRAFT: "aircrafts",
};

export default function ProductsPage() {
  const navigate = useNavigate();
  const user = useAuth((state) => state.user);
  const userSpeciality = user?.speciality as SpecialityType;
  const { searchTerm } = useContext(AppContext);

  // Define o tipo de produto inicial baseado na especialidade do usuário
  const initialProductType = userSpeciality
    ? specialityToProductType[userSpeciality]
    : "cars";

  const [productType, setProductType] = useState<ProductType>(initialProductType);
  const [products, setProducts] = useState<ProductListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productType]);

  const loadProducts = async () => {
    setLoading(true);
    try {
      if (productType === "cars") {
        const { cars } = await getCars(1, 100);
        setProducts(
          user?.role === "SPECIALIST" && user.id
            ? cars.filter((car: any) => car.specialist_id === user.id)
            : cars
        );
      } else if (productType === "boats") {
        const { boats } = await getBoats(1, 100);
        setProducts(
          user?.role === "SPECIALIST" && user.id
            ? boats.filter((boat: any) => boat.specialist_id === user.id)
            : boats
        );
      } else if (productType === "aircrafts") {
        const { aircrafts } = await getAircrafts(1, 100);
        setProducts(
          user?.role === "SPECIALIST" && user.id
            ? aircrafts.filter((aircraft: any) => aircraft.specialist_id === user.id)
            : aircrafts
        );
      }
    } catch (error) {
      console.error("Erro ao carregar produtos:", error);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Tem certeza que deseja excluir este produto?")) {
      return;
    }

    try {
      if (productType === "cars") {
        await deleteCar(id);
      } else if (productType === "boats") {
        await deleteBoat(id);
      } else if (productType === "aircrafts") {
        await deleteAircraft(id);
      }
      window.alert("Produto excluído com sucesso!");
      loadProducts();
    } catch (error) {
      console.error("Erro ao excluir produto:", error);
      window.alert("Erro ao excluir produto");
    }
  };

  const handleEdit = (id: string) => {
    navigate(`/specialist/products/edit/${productType}/${id}`);
  };

  const getProductTypeLabel = () => {
    if (productType === "cars") return "Carros";
    if (productType === "boats") return "Lanchas";
    return "Aeronaves";
  };

  // Filtra produtos baseado no termo de pesquisa
  const filteredProducts = products.filter((product) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      product.marca?.toLowerCase().includes(searchLower) ||
      product.modelo?.toLowerCase().includes(searchLower) ||
      product.ano?.toString().includes(searchLower) ||
      product.estado?.toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="w-full">
      <PageHeader
        title="Gestão de Produtos"
        actions={
          <Button type="button" onClick={() => navigate("/specialist/products/new")}>
            <Plus size={16} />
            Novo Produto
          </Button>
        }
      />

      {/* Filtro de Tipo (apenas se não tiver especialidade definida) */}
      {!userSpeciality && (
        <div className="flex gap-4 mb-4">
          <button
            onClick={() => setProductType("cars")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
              productType === "cars"
                ? "border-ink text-ink"
                : "border-transparent text-muted hover:text-ink-soft"
            }`}
          >
            Carros
          </button>
          <button
            onClick={() => setProductType("boats")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
              productType === "boats"
                ? "border-ink text-ink"
                : "border-transparent text-muted hover:text-ink-soft"
            }`}
          >
            Lanchas
          </button>
          <button
            onClick={() => setProductType("aircrafts")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
              productType === "aircrafts"
                ? "border-ink text-ink"
                : "border-transparent text-muted hover:text-ink-soft"
            }`}
          >
            Aeronaves
          </button>
        </div>
      )}

      {/* Mostra a especialidade do usuário (se tiver) */}
      {userSpeciality && (
        <Alert variant="info" className="mb-4">
          <p>
            <span className="font-semibold">Sua especialidade:</span>{" "}
            {getProductTypeLabel()}
          </p>
        </Alert>
      )}

      {/* Lista de Produtos */}
      <Card>
        <h2 className="text-h2 font-semibold text-ink mb-4">{getProductTypeLabel()}</h2>

        {loading ? (
          <p className="text-center text-muted py-8">Carregando...</p>
        ) : filteredProducts.length === 0 ? (
          <p className="text-center text-muted py-8">
            {searchTerm ? "Nenhum produto encontrado com esse termo de pesquisa" : "Nenhum produto cadastrado"}
          </p>
        ) : (
          <ResponsiveProductList
            products={filteredProducts}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        )}
      </Card>
    </div>
  );
}
