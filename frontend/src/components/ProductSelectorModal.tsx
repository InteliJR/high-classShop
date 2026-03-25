import { useState, useEffect } from "react";
import { X, Search, Car, Ship, Plane, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { getCars } from "../services/cars.service";
import { getBoats } from "../services/boats.service";
import { getAircrafts } from "../services/aircrafts.service";
import { assignProductToProcess, type Process } from "../services/processes.service";
import type { SpecialityType } from "../types/types";
import Button from "./ui/button";

interface ProductSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  process: Process;
  specialistId: string;
  specialistSpeciality: SpecialityType;
}

type ModalState = "initial" | "loading" | "selecting" | "assigning" | "success" | "error";

interface ProductItem {
  id: number;
  type: SpecialityType;
  marca: string;
  modelo: string;
  valor: number;
  ano: number;
  imageUrl?: string;
}

/**
 * Modal para seleção de produto em processos de consultoria
 * O especialista usa este modal para atribuir um produto após a reunião com o cliente
 */
export default function ProductSelectorModal({
  isOpen,
  onClose,
  onSuccess,
  process,
  specialistId,
  specialistSpeciality,
}: ProductSelectorModalProps) {
  const [modalState, setModalState] = useState<ModalState>("initial");
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<ProductItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<ProductItem | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const productTypeConfig: Record<SpecialityType, { label: string; icon: React.ReactNode }> = {
    CAR: { label: "Carros", icon: <Car size={20} /> },
    BOAT: { label: "Barcos", icon: <Ship size={20} /> },
    AIRCRAFT: { label: "Aeronaves", icon: <Plane size={20} /> },
  };

  // Carrega produtos do especialista
  useEffect(() => {
    if (isOpen) {
      loadProducts();
    }
  }, [isOpen, specialistId, specialistSpeciality]);

  // Filtra produtos pelo termo de busca
  useEffect(() => {
    if (searchTerm.trim() === "") {
      setFilteredProducts(products);
    } else {
      const term = searchTerm.toLowerCase();
      setFilteredProducts(
        products.filter(
          (p) =>
            p.marca.toLowerCase().includes(term) ||
            p.modelo.toLowerCase().includes(term)
        )
      );
    }
  }, [searchTerm, products]);

  const loadProducts = async () => {
    setModalState("loading");
    setErrorMessage("");
    setProducts([]);

    try {
      let productItems: ProductItem[] = [];

      // Carrega produtos baseado na especialidade do especialista
      switch (specialistSpeciality) {
        case "CAR": {
          const result = await getCars(1, 100, { specialist_id: specialistId });
          productItems = result.cars.map((car) => ({
            id: car.id,
            type: "CAR" as SpecialityType,
            marca: car.marca,
            modelo: car.modelo,
            valor: car.valor,
            ano: car.ano ?? 0,
            imageUrl: car.imageUrl,
          }));
          break;
        }
        case "BOAT": {
          const result = await getBoats(1, 100, { specialist_id: specialistId });
          productItems = result.boats.map((boat) => ({
            id: boat.id,
            type: "BOAT" as SpecialityType,
            marca: boat.marca,
            modelo: boat.modelo,
            valor: boat.valor,
            ano: boat.ano ?? 0,
            imageUrl: boat.imageUrl,
          }));
          break;
        }
        case "AIRCRAFT": {
          const result = await getAircrafts(1, 100, { specialist_id: specialistId });
          productItems = result.aircrafts.map((aircraft) => ({
            id: aircraft.id,
            type: "AIRCRAFT" as SpecialityType,
            marca: aircraft.marca,
            modelo: aircraft.modelo,
            valor: aircraft.valor,
            ano: aircraft.ano ?? 0,
            imageUrl: aircraft.imageUrl,
          }));
          break;
        }
      }

      setProducts(productItems);
      setFilteredProducts(productItems);
      setModalState("selecting");
    } catch (error: any) {
      setModalState("error");
      setErrorMessage(
        error?.response?.data?.error?.message ||
          error?.message ||
          "Erro ao carregar produtos"
      );
    }
  };

  const handleSelectProduct = (product: ProductItem) => {
    setSelectedProduct(product);
  };

  const handleConfirmSelection = async () => {
    if (!selectedProduct) return;

    setModalState("assigning");
    setErrorMessage("");

    try {
      await assignProductToProcess(
        process.id,
        selectedProduct.type,
        selectedProduct.id
      );

      setModalState("success");

      // Fecha o modal após 1.5 segundos
      setTimeout(() => {
        handleClose();
        onSuccess?.();
      }, 1500);
    } catch (error: any) {
      setModalState("error");
      setErrorMessage(
        error?.response?.data?.error?.message ||
          error?.message ||
          "Erro ao atribuir produto ao processo"
      );
    }
  };

  const handleClose = () => {
    setModalState("initial");
    setProducts([]);
    setFilteredProducts([]);
    setSearchTerm("");
    setSelectedProduct(null);
    setErrorMessage("");
    onClose();
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg text-primary">
              {productTypeConfig[specialistSpeciality].icon}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Selecionar Produto
              </h2>
              <p className="text-sm text-gray-500">
                Escolha um {productTypeConfig[specialistSpeciality].label.toLowerCase().slice(0, -1)} para este processo de consultoria
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            disabled={modalState === "assigning"}
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {modalState === "loading" && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <Loader2 size={40} className="animate-spin text-primary" />
              <p className="text-gray-600">Carregando seus produtos...</p>
            </div>
          )}

          {modalState === "error" && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <div className="p-4 bg-red-100 rounded-full">
                <AlertCircle size={40} className="text-red-600" />
              </div>
              <p className="text-gray-800 font-medium">Erro</p>
              <p className="text-gray-600 text-center max-w-md">{errorMessage}</p>
              <Button onClick={loadProducts} variant="solid">
                Tentar Novamente
              </Button>
            </div>
          )}

          {modalState === "success" && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <div className="p-4 bg-green-100 rounded-full">
                <CheckCircle2 size={40} className="text-green-600" />
              </div>
              <p className="text-gray-800 font-medium">Produto Atribuído!</p>
              <p className="text-gray-600 text-center">
                O processo foi atualizado e avançará para a fase de negociação.
              </p>
            </div>
          )}

          {(modalState === "selecting" || modalState === "assigning") && (
            <>
              {/* Search */}
              <div className="relative mb-4">
                <Search
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type="text"
                  placeholder="Buscar por marca ou modelo..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                  disabled={modalState === "assigning"}
                />
              </div>

              {/* Products List */}
              {filteredProducts.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  {searchTerm
                    ? "Nenhum produto encontrado com este termo"
                    : "Você não possui produtos cadastrados"}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {filteredProducts.map((product) => (
                    <div
                      key={`${product.type}-${product.id}`}
                      onClick={() =>
                        modalState !== "assigning" && handleSelectProduct(product)
                      }
                      className={`
                        border rounded-xl p-4 cursor-pointer transition-all
                        ${
                          selectedProduct?.id === product.id &&
                          selectedProduct?.type === product.type
                            ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                            : "border-gray-200 hover:border-gray-300 hover:shadow-sm"
                        }
                        ${modalState === "assigning" ? "opacity-50 cursor-not-allowed" : ""}
                      `}
                    >
                      <div className="flex gap-4">
                        {/* Product Image */}
                        <div className="w-20 h-20 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                          {product.imageUrl ? (
                            <img
                              src={product.imageUrl}
                              alt={`${product.marca} ${product.modelo}`}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400">
                              {productTypeConfig[product.type].icon}
                            </div>
                          )}
                        </div>

                        {/* Product Info */}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-gray-900 truncate">
                            {product.marca} {product.modelo}
                          </h3>
                          <p className="text-sm text-gray-500">Ano: {product.ano}</p>
                          <p className="text-sm font-semibold text-primary mt-1">
                            {formatCurrency(product.valor)}
                          </p>
                        </div>

                        {/* Selection indicator */}
                        {selectedProduct?.id === product.id &&
                          selectedProduct?.type === product.type && (
                            <div className="flex-shrink-0">
                              <CheckCircle2 size={24} className="text-primary" />
                            </div>
                          )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {(modalState === "selecting" || modalState === "assigning") && (
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
            <div className="text-sm text-gray-600">
              {selectedProduct ? (
                <span>
                  Selecionado:{" "}
                  <strong>
                    {selectedProduct.marca} {selectedProduct.modelo}
                  </strong>
                </span>
              ) : (
                <span>Selecione um produto para continuar</span>
              )}
            </div>
            <div className="flex gap-3">
              <Button
                onClick={handleClose}
                variant="light"
                disabled={modalState === "assigning"}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleConfirmSelection}
                variant="solid"
                disabled={!selectedProduct || modalState === "assigning"}
              >
                {modalState === "assigning" ? (
                  <>
                    <Loader2 size={18} className="animate-spin mr-2" />
                    Atribuindo...
                  </>
                ) : (
                  "Confirmar Seleção"
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
