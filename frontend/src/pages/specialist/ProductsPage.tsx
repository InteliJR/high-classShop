import { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../store/authStateManager";
import { AppContext } from "../../contexts/AppContext";
import { getCars, deleteCar } from "../../services/cars.service";
import { getBoats, deleteBoat } from "../../services/boats.service";
import { getAircrafts, deleteAircraft } from "../../services/aircrafts.service";
import type { SpecialityType } from "../../types/types";

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
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-text-primary">Gestão de Produtos</h1>
        <button
          onClick={() => navigate("/specialist/products/new")}
          className="px-4 py-2 bg-gray-700 text-white text-sm rounded hover:bg-gray-800 transition"
        >
          + Novo Produto
        </button>
      </div>

      {/* Filtro de Tipo (apenas se não tiver especialidade definida) */}
      {!userSpeciality && (
        <div className="flex gap-4">
          <button
            onClick={() => setProductType("cars")}
            className={`px-6 py-2 rounded-md transition ${
              productType === "cars"
                ? "bg-blue-600 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            Carros
          </button>
          <button
            onClick={() => setProductType("boats")}
            className={`px-6 py-2 rounded-md transition ${
              productType === "boats"
                ? "bg-blue-600 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            Lanchas
          </button>
          <button
            onClick={() => setProductType("aircrafts")}
            className={`px-6 py-2 rounded-md transition ${
              productType === "aircrafts"
                ? "bg-blue-600 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            Aeronaves
          </button>
        </div>
      )}

      {/* Mostra a especialidade do usuário (se tiver) */}
      {userSpeciality && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            <span className="font-semibold">Sua especialidade:</span>{" "}
            {getProductTypeLabel()}
          </p>
        </div>
      )}

      {/* Lista de Produtos */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-text-primary mb-4">{getProductTypeLabel()}</h2>

        {loading ? (
          <p className="text-center text-gray-500 py-8">Carregando...</p>
        ) : filteredProducts.length === 0 ? (
          <p className="text-center text-gray-500 py-8">
            {searchTerm ? "Nenhum produto encontrado com esse termo de pesquisa" : "Nenhum produto cadastrado"}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b">
                <tr className="text-left">
                  <th className="pb-3 text-sm font-medium text-gray-600">Marca</th>
                  <th className="pb-3 text-sm font-medium text-gray-600">Modelo</th>
                  <th className="pb-3 text-sm font-medium text-gray-600">Ano</th>
                  <th className="pb-3 text-sm font-medium text-gray-600">Valor</th>
                  <th className="pb-3 text-sm font-medium text-gray-600">Estado</th>
                  <th className="pb-3 text-sm font-medium text-gray-600 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product) => (
                  <tr key={product.id} className="border-b hover:bg-gray-50">
                    <td className="py-3">{product.marca}</td>
                    <td className="py-3">{product.modelo}</td>
                    <td className="py-3">{product.ano || "-"}</td>
                    <td className="py-3">R$ {product.valor?.toLocaleString("pt-BR") || "0"}</td>
                    <td className="py-3 capitalize">{product.estado || "-"}</td>
                    <td className="py-3">
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => handleEdit(product.id)}
                          className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
                          title="Editar"
                        >
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                            />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(product.id)}
                          className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
                          title="Excluir"
                        >
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

