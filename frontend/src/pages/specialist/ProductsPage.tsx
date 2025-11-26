import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getCars, deleteCar } from "../../services/cars.service";
import { getBoats, deleteBoat } from "../../services/boats.service";
import { getAircrafts, deleteAircraft } from "../../services/aircrafts.service";

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

export default function ProductsPage() {
  const navigate = useNavigate();
  const [productType, setProductType] = useState<ProductType>("cars");
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
        setProducts(cars);
      } else if (productType === "boats") {
        const { boats } = await getBoats(1, 100);
        setProducts(boats);
      } else if (productType === "aircrafts") {
        const { aircrafts } = await getAircrafts(1, 100);
        setProducts(aircrafts);
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

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-text-primary">Gestão de Produtos</h1>
        <button
          onClick={() => navigate("/specialist/products/new")}
          className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
        >
          + Novo Produto
        </button>
      </div>

      {/* Filtro de Tipo */}
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

      {/* Lista de Produtos */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-text-primary mb-4">{getProductTypeLabel()}</h2>

        {loading ? (
          <p className="text-center text-gray-500 py-8">Carregando...</p>
        ) : products.length === 0 ? (
          <p className="text-center text-gray-500 py-8">Nenhum produto cadastrado</p>
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
                {products.map((product) => (
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
                          className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded transition"
                          title="Editar"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => handleDelete(product.id)}
                          className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded transition"
                          title="Excluir"
                        >
                          Excluir
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

