import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import ProductForm from "../../components/specialist/ProductForm";
import { getCarById, type RawCar } from "../../services/cars.service";
import { getBoatById, type RawBoat } from "../../services/boats.service";
import { getAircraftById, type RawAircraft } from "../../services/aircrafts.service";
import {
  getCalendlyAuthorizeUrl,
  getCalendlyOAuthStatus,
} from "../../services/appointments.service";

type ProductType = "CAR" | "BOAT" | "AIRCRAFT";

export default function ProductFormPage() {
  const { productType, id } = useParams<{ productType?: string; id?: string }>();
  const [searchParams] = useSearchParams();
  const processId = searchParams.get("processId") ?? undefined;
  const [productData, setProductData] = useState<RawCar | RawBoat | RawAircraft | undefined>();
  const [loading, setLoading] = useState(false);
  const [calendlyConnected, setCalendlyConnected] = useState<boolean | null>(null);
  const [connectingCalendly, setConnectingCalendly] = useState(false);

  const mode = id ? "edit" : "create";

  useEffect(() => {
    if (mode === "edit" && id && productType) {
      loadProductData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, productType]);

  useEffect(() => {
    if (mode !== "create") return;
    getCalendlyOAuthStatus()
      .then((status) => setCalendlyConnected(status.connected))
      .catch(() => setCalendlyConnected(true)); // falha na checagem não deve travar o form; backend segue como fonte da verdade
  }, [mode]);

  const handleConnectCalendly = async () => {
    setConnectingCalendly(true);
    try {
      const authorizeUrl = await getCalendlyAuthorizeUrl();
      window.location.href = authorizeUrl;
    } catch {
      setConnectingCalendly(false);
    }
  };

  const loadProductData = async () => {
    if (!id || !productType) return;

    setLoading(true);
    try {
      const productId = id;

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
            ? processId
              ? "Preencha os campos abaixo — o produto será vinculado automaticamente a este processo"
              : "Preencha os campos abaixo para cadastrar um novo produto"
            : "Atualize as informações do produto"}
        </p>
      </div>

      {/* Formulário */}
      <div className="bg-white rounded-lg shadow-md p-6">
        {loading || (mode === "create" && calendlyConnected === null) ? (
          <p className="text-center text-gray-500 py-8">Carregando...</p>
        ) : mode === "create" && calendlyConnected === false ? (
          <div className="text-center py-8">
            <h2 className="text-lg font-semibold text-text-primary mb-2">
              Conecte seu Calendly para anunciar produtos
            </h2>
            <p className="text-gray-600 mb-4">
              Antes de cadastrar um anúncio, conecte sua conta do Calendly para
              que clientes consigam agendar reuniões com você.
            </p>
            <button
              type="button"
              onClick={handleConnectCalendly}
              disabled={connectingCalendly}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {connectingCalendly ? "Conectando..." : "Conectar Calendly"}
            </button>
          </div>
        ) : (
          <ProductForm
            mode={mode}
            productType={mode === "edit" ? getProductTypeEnum() : undefined}
            productData={productData}
            productId={id}
            processId={mode === "create" ? processId : undefined}
          />
        )}
      </div>
    </div>
  );
}
