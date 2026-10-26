import api from "./api";
import type { PaginationMeta, Product, ResponseAPI } from "../types/types";
import {
  resolveImportResponse,
  type CsvImportResponse,
  type ImportJobAcceptedResponse,
} from "./product-import-jobs.service";

export type JourneyProductType = "CAR" | "BOAT" | "AIRCRAFT";
export type ProductImportMode = "ADDITIVE" | "SYNCHRONIZE";

const resourceByType: Record<JourneyProductType, string> = {
  CAR: "cars",
  BOAT: "boats",
  AIRCRAFT: "aircrafts",
};

export type AdminCatalogProduct = Product & { is_active: boolean };

export type AdminClientOption = {
  id: string;
  name: string;
  surname: string;
  email: string;
};

export async function getAdminClientOptions(
  search = "",
): Promise<AdminClientOption[]> {
  const response = await api.get<AdminClientOption[]>(
    "/processes/admin/client-options",
    { params: { search } },
  );
  return response.data;
}

export async function getAdminSpecialistProducts(
  productType: JourneyProductType,
  page: number,
  perPage: number,
): Promise<{ products: AdminCatalogProduct[]; pagination: PaginationMeta }> {
  const resource = resourceByType[productType];
  const response = await api.get<ResponseAPI<any, Record<string, unknown>>>(
    `/${resource}/admin/all`,
    { params: { page, perPage } },
  );
  const products = response.data.data.map((raw) => ({
    ...raw,
    valor: Number(raw.valor),
    imageUrl:
      raw.images?.find((image: { is_primary: boolean }) => image.is_primary)
        ?.image_url ?? "",
  }));
  return { products, pagination: response.data.meta.pagination };
}

export type CsvImportPreview = {
  productType: JourneyProductType;
  targetSpecialistId: string;
  mode: ProductImportMode;
  requiresExplicitConfirmation: boolean;
  synchronizePreviewToken?: string;
  impact: {
    incomingItems: number;
    activeItemsBefore: number;
    matchingItems: number;
    newOrReactivatedItems: number;
    deactivationCandidates: number;
  };
};

function importForm(
  file: File,
  specialistId: string,
  mode: ProductImportMode,
  confirmSynchronize = false,
  synchronizePreviewToken?: string,
): FormData {
  const form = new FormData();
  form.append("file", file);
  form.append("specialist_id", specialistId);
  form.append("mode", mode);
  form.append("confirm_synchronize", String(confirmSynchronize));
  if (synchronizePreviewToken) {
    form.append("synchronize_preview_token", synchronizePreviewToken);
  }
  return form;
}

export async function previewAdminCatalogCsv(
  productType: JourneyProductType,
  specialistId: string,
  file: File,
  mode: ProductImportMode,
): Promise<CsvImportPreview> {
  const resource = resourceByType[productType];
  const response = await api.post<CsvImportPreview>(
    `/${resource}/import-csv/preview`,
    importForm(file, specialistId, mode),
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return response.data;
}

export async function importAdminCatalogCsv(
  productType: JourneyProductType,
  specialistId: string,
  file: File,
  mode: ProductImportMode,
  confirmSynchronize: boolean,
  synchronizePreviewToken?: string,
): Promise<CsvImportResponse> {
  const resource = resourceByType[productType];
  const response = await api.post<
    CsvImportResponse | ImportJobAcceptedResponse
  >(
    `/${resource}/import-csv`,
    importForm(
      file,
      specialistId,
      mode,
      confirmSynchronize,
      synchronizePreviewToken,
    ),
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return resolveImportResponse(response.data);
}
