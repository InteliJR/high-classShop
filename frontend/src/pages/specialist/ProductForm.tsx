import { useForm } from "react-hook-form";
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../store/authStateManager";
import CommonProductFields from "./CommonProductFields";
import CarFields from "./CarFields";
import BoatFields from "./BoatFields";
import AircraftFields from "./AircraftFields";
import { ImageUploader, type ImageData } from "../../components/ImageUploader";
import {
  createCar,
  updateCar,
  type RawCar,
  importCarsXlsx,
  getCarsXlsxTemplate,
} from "../../services/cars.service";
import {
  createBoat,
  updateBoat,
  type RawBoat,
  importBoatsXlsx,
  getBoatsXlsxTemplate,
} from "../../services/boats.service";
import {
  createAircraft,
  updateAircraft,
  type RawAircraft,
  importAircraftsXlsx,
  getAircraftsXlsxTemplate,
} from "../../services/aircrafts.service";
import {
  XlsxImporter,
  type XlsxImportResponse,
} from "../../components/XlsxImporter";
import { Modal } from "../../components/Modal";
import type { SpecialityType, UserRole } from "../../types/types";

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

export default function ProductForm({
  mode,
  productType: initialProductType,
  productData,
  productId,
}: ProductFormProps) {
  const navigate = useNavigate();
  const user = useAuth((state) => state.user);
  const userSpeciality = user?.speciality as SpecialityType;
  const userRole = user?.role as UserRole;

  // Define o tipo de produto baseado na especialidade do usuário
  const [productType, setProductType] = useState<ProductType>(
    initialProductType || userSpeciality || "CAR",
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [images, setImages] = useState<ImageData[]>([]);
  const [isXlsxModalOpen, setIsXlsxModalOpen] = useState(false);

  // Validação de autorização: ADMIN pode criar qualquer tipo, SPECIALIST só do seu tipo
  const canCreateProductType = useCallback(
    (type: ProductType): boolean => {
      if (userRole === "ADMIN") return true;
      if (userRole === "SPECIALIST") {
        return userSpeciality === type;
      }
      return false;
    },
    [userRole, userSpeciality],
  );

  // Verificar se o usuário pode criar o tipo de produto selecionado
  const isAuthorized = canCreateProductType(productType);

  // Funções de import/template por tipo
  const handleXlsxImport = useCallback(
    async (file: File): Promise<XlsxImportResponse> => {
      if (!canCreateProductType(productType)) {
        throw {
          message: `Você não tem permissão para criar ${productType === "CAR" ? "carros" : productType === "BOAT" ? "lanchas" : "aeronaves"}.`,
        };
      }

      switch (productType) {
        case "CAR":
          return importCarsXlsx(file);
        case "BOAT":
          return importBoatsXlsx(file);
        case "AIRCRAFT":
          return importAircraftsXlsx(file);
      }
    },
    [productType, canCreateProductType],
  );

  const handleDownloadXlsxTemplate = useCallback(async (): Promise<void> => {
    switch (productType) {
      case "CAR":
        return getCarsXlsxTemplate();
      case "BOAT":
        return getBoatsXlsxTemplate();
      case "AIRCRAFT":
        return getAircraftsXlsxTemplate();
    }
  }, [productType]);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ProductFormData>({
    defaultValues: (productData as any) || {},
  });

  // Função para converter URL de imagem para base64
  const urlToBase64 = async (url: string): Promise<string> => {
    try {
      const response = await fetch(url, { mode: "cors" });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error("Erro ao converter URL para base64:", error);
      // Retornar a URL original como fallback
      return url;
    }
  };

  // Atualiza o formulário quando os dados do produto mudam
  useEffect(() => {
    const loadProductData = async () => {
      if (productData) {
        reset(productData as any);

        // Carregar imagens existentes no modo de edição
        if (
          mode === "edit" &&
          productData.images &&
          productData.images.length > 0
        ) {
          // Converter URLs do S3 para base64
          const existingImages: ImageData[] = await Promise.all(
            productData.images.map(async (img: any) => ({
              id: img.id,
              data: await urlToBase64(img.image_url), // Converter URL para base64
              is_primary: img.is_primary,
              preview: img.image_url, // Manter URL para preview
              isExisting: true,
            })),
          );
          setImages(existingImages);
        }
      }
    };

    loadProductData();
  }, [productData, reset, mode]);

  const onSubmit = async (data: any) => {
    // Validar autorização antes de enviar
    if (!canCreateProductType(productType)) {
      window.alert(
        `Você não tem permissão para ${mode === "create" ? "criar" : "editar"} ${productType === "CAR" ? "carros" : productType === "BOAT" ? "lanchas" : "aeronaves"}.`,
      );
      return;
    }

    // Validar que pelo menos uma imagem foi adicionada
    if (images.length === 0) {
      window.alert("Ao menos uma imagem é obrigatória para o produto.");
      return;
    }

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

      // Vincula o produto ao especialista logado (quando aplicável)
      if (user?.role === "SPECIALIST" && user.id) {
        formattedData.specialist_id = user.id;
      }

      // Adiciona campos específicos de cada tipo de produto (apenas se preenchidos)
      if (productType === "CAR") {
        if (data.cor) formattedData.cor = data.cor;
        if (data.km) formattedData.km = Number(data.km);
        if (data.cambio) formattedData.cambio = data.cambio;
        if (data.combustivel) formattedData.combustivel = data.combustivel;
        if (data.tipo_categoria)
          formattedData.tipo_categoria = data.tipo_categoria;
        if (data.descricao) formattedData.descricao = data.descricao;
      } else if (productType === "BOAT") {
        if (data.fabricante) formattedData.fabricante = data.fabricante;
        if (data.tamanho) formattedData.tamanho = data.tamanho;
        if (data.estilo) formattedData.estilo = data.estilo;
        if (data.combustivel) formattedData.combustivel = data.combustivel;
        if (data.motor) formattedData.motor = data.motor;
        if (data.ano_motor) formattedData.ano_motor = Number(data.ano_motor);
        if (data.tipo_embarcacao)
          formattedData.tipo_embarcacao = data.tipo_embarcacao;
        if (data.descricao_completa)
          formattedData.descricao_completa = data.descricao_completa;
        if (data.acessorios) formattedData.acessorios = data.acessorios;
      } else if (productType === "AIRCRAFT") {
        if (data.categoria) formattedData.categoria = data.categoria;
        if (data.assentos) formattedData.assentos = Number(data.assentos);
        if (data.tipo_aeronave)
          formattedData.tipo_aeronave = data.tipo_aeronave;
        if (data.descricao) formattedData.descricao = data.descricao;
      }

      // Adicionar TODAS as imagens (existentes já foram convertidas para base64)
      if (images.length > 0) {
        formattedData.images = images.map((img) => ({
          data: img.data,
          is_primary: img.is_primary,
        }));
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
      {/* Alerta de autorização se não autorizado */}
      {!isAuthorized && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 font-semibold">
            Voce nao tem permissao para criar{" "}
            {productType === "CAR"
              ? "carros"
              : productType === "BOAT"
                ? "lanchas"
                : "aeronaves"}
            .
          </p>
          <p className="text-red-600 text-sm mt-1">
            Sua especialidade é: {userSpeciality || "não definida"}. Apenas
            ADMIN pode criar qualquer tipo de produto.
          </p>
        </div>
      )}

      {/* Seletor de Tipo de Produto (apenas no modo criar e se for ADMIN sem especialidade) */}
      {mode === "create" && userRole === "ADMIN" && (
        <div className="flex flex-col gap-2">
          <label
            htmlFor="productType"
            className="text-lg font-semibold text-text-primary"
          >
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
      {mode === "create" && userSpeciality && userRole !== "ADMIN" && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            <span className="font-semibold">Categoria:</span>{" "}
            {productType === "CAR" && "Carros de Alto Padrão"}
            {productType === "BOAT" && "Lanchas e Embarcações"}
            {productType === "AIRCRAFT" && "Aeronaves Executivas"}
          </p>
        </div>
      )}

      {/* Botao para abrir modal de importacao XLSX - apenas no modo criar */}
      {mode === "create" && (
        <div className="border-t pt-6">
          <div className="flex items-center gap-4">
            <h3 className="text-lg font-semibold text-text-primary">
              Importação em Lote
            </h3>
            <button
              type="button"
              onClick={() => setIsXlsxModalOpen(true)}
              disabled={!isAuthorized || isSubmitting}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              Upload Planilha
            </button>
          </div>
          <p className="text-gray-500 text-sm mt-2">
            Importe vários produtos de uma vez usando um arquivo XLSX com
            imagens embutidas.
          </p>
        </div>
      )}

      {/* Modal de importacao XLSX */}
      <Modal
        isOpen={isXlsxModalOpen}
        onClose={() => setIsXlsxModalOpen(false)}
        title={`Importar ${productType === "CAR" ? "Carros" : productType === "BOAT" ? "Lanchas" : "Aeronaves"} via Planilha XLSX`}
        size="lg"
      >
        <XlsxImporter
          productType={productType}
          onImport={handleXlsxImport}
          onDownloadTemplate={handleDownloadXlsxTemplate}
          disabled={!isAuthorized || isSubmitting}
          onSuccess={() => setIsXlsxModalOpen(false)}
        />
      </Modal>

      {/* Campos Comuns */}
      <div className="grid grid-cols-2 gap-4">
        <CommonProductFields
          register={register}
          errors={errors}
          productType={productType}
        />
      </div>

      {/* Campos Específicos por Tipo */}
      <div className="border-t pt-6">
        <h3 className="text-lg font-semibold text-text-primary mb-4">
          Informações Específicas
        </h3>
        <div className="grid grid-cols-2 gap-4">
          {productType === "CAR" && (
            <CarFields register={register} errors={errors} />
          )}
          {productType === "BOAT" && (
            <BoatFields register={register} errors={errors} />
          )}
          {productType === "AIRCRAFT" && (
            <AircraftFields register={register} errors={errors} />
          )}
        </div>
      </div>

      {/* Upload de Imagens */}
      <div className="border-t pt-6">
        <h3 className="text-lg font-semibold text-text-primary mb-4">
          Imagens do Produto
        </h3>
        <ImageUploader
          images={images}
          onChange={setImages}
          maxImages={10}
          maxSizeMB={5}
        />
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
          disabled={isSubmitting || !isAuthorized}
        >
          {isSubmitting
            ? "Salvando..."
            : mode === "create"
              ? "Criar Produto"
              : "Salvar Alterações"}
        </button>
      </div>
    </form>
  );
}
