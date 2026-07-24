import { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Pencil, Trash2 } from "lucide-react";
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

type ProductType = "cars" | "boats" | "aircrafts";

interface Product {
  id: number;
  marca: string;
  modelo: string;
  ano?: number;
  valor: number;
  estado?: string;
  descricao?: string;
  imageUrl?: string;
}

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
  const [products, setProducts] = useState<Product[]>([]);
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

  const handleDelete = async (id: number) => {
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

  const handleEdit = (id: number) => {
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
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-border">
                <tr className="text-left">
                  <th className="pb-3 text-sm font-medium text-muted">Foto</th>
                  <th className="pb-3 text-sm font-medium text-muted">Marca</th>
                  <th className="pb-3 text-sm font-medium text-muted">Modelo</th>
                  <th className="pb-3 text-sm font-medium text-muted">Ano</th>
                  <th className="pb-3 text-sm font-medium text-muted">Valor</th>
                  <th className="pb-3 text-sm font-medium text-muted">Estado</th>
                  <th className="pb-3 text-sm font-medium text-muted text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product) => (
                  <tr key={product.id} className="border-b border-border-soft hover:bg-border-soft/50">
                    <td className="py-3 pr-3">
                      {product.imageUrl ? (
                        <img
                          src={product.imageUrl}
                          alt={`${product.marca} ${product.modelo}`}
                          className="w-16 h-16 object-cover rounded-md border border-border"
                          loading="lazy"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.display = "none";
                          }}
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-md border border-border bg-border-soft flex items-center justify-center text-subtle text-xs">
                          sem foto
                        </div>
                      )}
                    </td>
                    <td className="py-3">{product.marca}</td>
                    <td className="py-3">{product.modelo}</td>
                    <td className="py-3">{product.ano || "-"}</td>
                    <td className="py-3">R$ {product.valor?.toLocaleString("pt-BR") || "0"}</td>
                    <td className="py-3 capitalize">{product.estado || "-"}</td>
                    <td className="py-3">
                      <div className="flex gap-1 justify-end">
                        <button
                          onClick={() => handleEdit(product.id)}
                          className="p-1.5 rounded hover:bg-border-soft text-ink-soft transition"
                          title="Editar"
                        >
                          <Pencil size={18} />
                        </button>
                        <button
                          onClick={() => handleDelete(product.id)}
                          className="p-1.5 rounded hover:bg-status-bad-wash text-status-bad transition"
                          title="Excluir"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
