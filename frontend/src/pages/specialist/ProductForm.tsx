import { useForm } from "react-hook-form";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../store/authStateManager";
import CommonProductFields from "./CommonProductFields";
import CarFields from "./CarFields";
import BoatFields from "./BoatFields";
import AircraftFields from "./AircraftFields";
import { createCar, updateCar, type RawCar } from "../../services/cars.service";
import { createBoat, updateBoat, type RawBoat } from "../../services/boats.service";
import { createAircraft, updateAircraft, type RawAircraft } from "../../services/aircrafts.service";
import type { SpecialityType } from "../../types/types";

type ProductType = "CAR" | "BOAT" | "AIRCRAFT";

interface ProductFormData {
  marca: string;
  modelo: string;
  ano: number;
  valor: number;
  estado: string;
  [key: string]: any;
}

interface ProductFormProps {
  mode: "create" | "edit";
  productType?: ProductType;
  productData?: RawCar | RawBoat | RawAircraft;
  productId?: number;
}

export default function ProductForm({ mode, productType: initialProductType, productData, productId }: ProductFormProps) {
  const navigate = useNavigate();
  const user = useAuth((state) => state.user);
  const userSpeciality = user?.speciality as SpecialityType;

  // Define o tipo de produto baseado na especialidade do usuário
  const [productType, setProductType] = useState<ProductType>(
    initialProductType || userSpeciality || "CAR"
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ProductFormData>({
    defaultValues: productData as any || {},
  });

  // Atualiza o formulário quando os dados do produto mudam
  useEffect(() => {
    if (productData) {
      reset(productData as any);
    }
  }, [productData, reset]);

  const onSubmit = async (data: any) => {
    setIsSubmitting(true);
    try {
      // Remove campos vazios e converte valores numéricos
      const formattedData: any = {
        marca: data.marca,
        modelo: data.modelo,
        ano: Number(data.ano),
        valor: Number(data.valor),
        estado: data.estado,
      };

      // Adiciona campos específicos de cada tipo de produto (apenas se preenchidos)
      if (productType === "CAR") {
        if (data.cor) formattedData.cor = data.cor;
        if (data.km) formattedData.km = Number(data.km);
        if (data.cambio) formattedData.cambio = data.cambio;
        if (data.combustivel) formattedData.combustivel = data.combustivel;
        if (data.tipo_categoria) formattedData.tipo_categoria = data.tipo_categoria;
        if (data.descricao) formattedData.descricao = data.descricao;
      } else if (productType === "BOAT") {
        if (data.fabricante) formattedData.fabricante = data.fabricante;
        if (data.tamanho) formattedData.tamanho = data.tamanho;
        if (data.estilo) formattedData.estilo = data.estilo;
        if (data.combustivel) formattedData.combustivel = data.combustivel;
        if (data.motor) formattedData.motor = data.motor;
        if (data.ano_motor) formattedData.ano_motor = Number(data.ano_motor);
        if (data.tipo_embarcacao) formattedData.tipo_embarcacao = data.tipo_embarcacao;
        if (data.descricao_completa) formattedData.descricao_completa = data.descricao_completa;
        if (data.acessorios) formattedData.acessorios = data.acessorios;
      } else if (productType === "AIRCRAFT") {
        if (data.categoria) formattedData.categoria = data.categoria;
        if (data.assentos) formattedData.assentos = Number(data.assentos);
        if (data.tipo_aeronave) formattedData.tipo_aeronave = data.tipo_aeronave;
        if (data.descricao) formattedData.descricao = data.descricao;
      }

      if (mode === "create") {
        // Criar novo produto
        if (productType === "CAR") {
          await createCar(formattedData);
        } else if (productType === "BOAT") {
          await createBoat(formattedData);
        } else if (productType === "AIRCRAFT") {
          await createAircraft(formattedData);
        }
        window.alert("Produto criado com sucesso!");
      } else {
        // Editar produto existente
        if (!productId) {
          throw new Error("ID do produto não fornecido");
        }
        if (productType === "CAR") {
          await updateCar(productId, formattedData);
        } else if (productType === "BOAT") {
          await updateBoat(productId, formattedData);
        } else if (productType === "AIRCRAFT") {
          await updateAircraft(productId, formattedData);
        }
        window.alert("Produto atualizado com sucesso!");
      }

      // Navega para a lista de produtos
      navigate("/specialist/products");
    } catch (error: any) {
      console.error("Erro ao salvar produto:", error);

      let errorMessage = "Erro ao salvar produto. Tente novamente.";

      if (error.response?.data?.message) {
        if (Array.isArray(error.response.data.message)) {
          errorMessage = error.response.data.message.join(", ");
        } else {
          errorMessage = error.response.data.message;
        }
      } else if (error.message) {
        errorMessage = error.message;
      }

      window.alert(`Erro: ${errorMessage}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
      {/* Seletor de Tipo de Produto (apenas no modo criar e se não tiver especialidade) */}
      {mode === "create" && !userSpeciality && (
        <div className="flex flex-col gap-2">
          <label htmlFor="productType" className="text-lg font-semibold text-text-primary">
            Tipo de Produto *
          </label>
          <select
            id="productType"
            value={productType}
            onChange={(e) => setProductType(e.target.value as ProductType)}
            className="px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
          >
            <option value="CAR">Carro</option>
            <option value="BOAT">Lancha</option>
            <option value="AIRCRAFT">Aeronave</option>
          </select>
        </div>
      )}

      {/* Mostra a especialidade do usuário (se tiver) */}
      {mode === "create" && userSpeciality && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            <span className="font-semibold">Categoria:</span>{" "}
            {productType === "CAR" && "Carros de Alto Padrão"}
            {productType === "BOAT" && "Lanchas e Embarcações"}
            {productType === "AIRCRAFT" && "Aeronaves Executivas"}
          </p>
        </div>
      )}

      {/* Campos Comuns */}
      <div className="grid grid-cols-2 gap-4">
        <CommonProductFields register={register} errors={errors} productType={productType} />
      </div>

      {/* Campos Específicos por Tipo */}
      <div className="border-t pt-6">
        <h3 className="text-lg font-semibold text-text-primary mb-4">
          Informações Específicas
        </h3>
        <div className="grid grid-cols-2 gap-4">
          {productType === "CAR" && <CarFields register={register} errors={errors} />}
          {productType === "BOAT" && <BoatFields register={register} errors={errors} />}
          {productType === "AIRCRAFT" && <AircraftFields register={register} errors={errors} />}
        </div>
      </div>

      {/* Botões de Ação */}
      <div className="flex gap-4 justify-end border-t pt-6">
        <button
          type="button"
          onClick={() => navigate("/specialist/products")}
          className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition"
          disabled={isSubmitting}
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition disabled:bg-gray-400"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Salvando..." : mode === "create" ? "Criar Produto" : "Salvar Alterações"}
        </button>
      </div>
    </form>
  );
}

