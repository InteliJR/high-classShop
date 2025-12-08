import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import ProductForm from "./ProductForm";
import { getCarById, type RawCar } from "../../services/cars.service";
import { getBoatById, type RawBoat } from "../../services/boats.service";
import { getAircraftById, type RawAircraft } from "../../services/aircrafts.service";

type ProductType = "CAR" | "BOAT" | "AIRCRAFT";

export default function ProductFormPage() {
  const { productType, id } = useParams<{ productType?: string; id?: string }>();
  const [productData, setProductData] = useState<RawCar | RawBoat | RawAircraft | undefined>();
  const [loading, setLoading] = useState(false);

  const mode = id ? "edit" : "create";

  useEffect(() => {
    if (mode === "edit" && id && productType) {
      loadProductData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, productType]);

  const loadProductData = async () => {
    if (!id || !productType) return;

    setLoading(true);
    try {
      const productId = Number(id);

      if (productType === "cars") {
        const data = await getCarById(productId);
        setProductData(data);
      } else if (productType === "boats") {
        const data = await getBoatById(productId);
        setProductData(data);
      } else if (productType === "aircrafts") {
        const data = await getAircraftById(productId);
        setProductData(data);
      }
    } catch (error) {
      console.error("Erro ao carregar produto:", error);
      window.alert("Erro ao carregar produto");
    } finally {
      setLoading(false);
    }
  };

  const getProductTypeEnum = (): ProductType => {
    if (productType === "cars") return "CAR";
    if (productType === "boats") return "BOAT";
    return "AIRCRAFT";
  };

  const getPageTitle = () => {
    if (mode === "create") return "Novo Produto";
    if (productType === "cars") return "Editar Carro";
    if (productType === "boats") return "Editar Lancha";
    return "Editar Aeronave";
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-text-primary">{getPageTitle()}</h1>
        <p className="text-gray-600 mt-2">
          {mode === "create"
            ? "Preencha os campos abaixo para cadastrar um novo produto"
            : "Atualize as informações do produto"}
        </p>
      </div>

      {/* Formulário */}
      <div className="bg-white rounded-lg shadow-md p-6">
        {loading ? (
          <p className="text-center text-gray-500 py-8">Carregando...</p>
        ) : (
          <ProductForm
            mode={mode}
            productType={mode === "edit" ? getProductTypeEnum() : undefined}
            productData={productData}
            productId={id ? Number(id) : undefined}
          />
        )}
      </div>
    </div>
  );
}

