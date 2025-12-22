import api from "./api";
import type { Product } from "../types/types";
import type { UserRole } from "../types/types";

export interface SelectOption {
  id: string | number;
  label: string;
  value: string;
}

export interface ClientOption extends SelectOption {
  email: string;
  role: UserRole;
}

export interface ProductOption extends SelectOption {
  marca: string;
  modelo: string;
  ano: number;
  valor: number;
  imageUrl?: string;
}

/**
 * Fetch all clients (CUSTOMER users)
 * Used to populate Client select in CreateProcessModal
 */
export async function fetchClients(): Promise<ClientOption[]> {
  try {
    const response = await api.get("/users?role=CUSTOMER", {
      withCredentials: true,
    });

    return (response.data.data || []).map(
      (user: {
        id: string;
        name: string;
        surname: string;
        email: string;
        role: UserRole;
      }) => ({
        id: user.id,
        label: `${user.name} ${user.surname}`,
        value: user.id,
        email: user.email,
        role: user.role,
      })
    );
  } catch (error) {
    console.error("Erro ao buscar clientes:", error);
    throw new Error(
      "Não foi possível carregar a lista de clientes. Por favor, tente novamente."
    );
  }
}

/**
 * Fetch products by type (CAR, BOAT, AIRCRAFT)
 * Used to populate Product select in CreateProcessModal
 * @param productType - Type of product to fetch (CAR, BOAT, AIRCRAFT)
 */
export async function fetchAvailableProducts(
  productType: "CAR" | "BOAT" | "AIRCRAFT"
): Promise<ProductOption[]> {
  try {
    const endpointMap: Record<"CAR" | "BOAT" | "AIRCRAFT", string> = {
      CAR: "cars",
      BOAT: "boats",
      AIRCRAFT: "aircraft",
    };

    const endpoint = endpointMap[productType];
    const response = await api.get(`/${endpoint}`, {
      withCredentials: true,
      params: {page: 1, perPage:20}
    });

    const products = response.data.data || [];

    return products.map(
      (product: {
        id: number | string;
        marca: string;
        modelo: string;
        ano: number;
        valor: number;
        imageUrl?: string;
      }) => ({
        id: product.id,
        label: `${product.marca} ${product.modelo} (${product.ano})`,
        value: String(product.id),
        marca: product.marca,
        modelo: product.modelo,
        ano: product.ano,
        valor: product.valor,
        imageUrl: product.imageUrl,
      })
    );
  } catch (error) {
    console.error(`Erro ao buscar produtos do tipo ${productType}:`, error);
    throw new Error(
      `Não foi possível carregar a lista de ${
        productType === "CAR"
          ? "carros"
          : productType === "BOAT"
          ? "barcos"
          : "aeronaves"
      }. Por favor, tente novamente.`
    );
  }
}

/**
 * Fetch product details by ID and type
 * Used to display product info in ProcessCard
 * @param productId - ID of the product
 * @param productType - Type of product (CAR, BOAT, AIRCRAFT)
 */
export async function fetchProductDetails(
  productId: string | number,
  productType: "CAR" | "BOAT" | "AIRCRAFT"
): Promise<Product> {
  try {
    const endpointMap: Record<"CAR" | "BOAT" | "AIRCRAFT", string> = {
      CAR: "cars",
      BOAT: "boats",
      AIRCRAFT: "aircraft",
    };

    const endpoint = endpointMap[productType];
    const response = await api.get(`/${endpoint}/${productId}`, {
      withCredentials: true,
    });

    const product = response.data.data;
    return {
      id: product.id,
      marca: product.marca,
      modelo: product.modelo,
      descricao: product.descricao || "",
      valor: product.valor,
      imageUrl: product.images?.[0]?.image_url || undefined,
      ano: product.ano,
      estado: product.estado || "Seminovo",
    };
  } catch (error) {
    console.error("Erro ao buscar detalhes do produto:", error);
    throw new Error(
      "Não foi possível carregar os detalhes do produto. Por favor, tente novamente."
    );
  }
}
