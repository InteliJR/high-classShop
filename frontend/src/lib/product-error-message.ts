type ProductSaveError = {
  response?: {
    data?: {
      code?: string;
      message?: string | string[];
    };
  };
  message?: string;
};

const MONETARY_FIELDS_LOCKED_MESSAGE =
  "Valor e moeda não podem ser alterados enquanto o produto estiver em negociação.";

export function getProductSaveErrorMessage(error: ProductSaveError): string {
  if (error.response?.data?.code === "PRODUCT_MONETARY_FIELDS_LOCKED") {
    return MONETARY_FIELDS_LOCKED_MESSAGE;
  }

  const responseMessage = error.response?.data?.message;
  if (Array.isArray(responseMessage)) {
    return responseMessage.join(", ");
  }
  if (responseMessage) {
    return responseMessage;
  }
  if (error.message) {
    return error.message;
  }

  return "Erro ao salvar produto. Tente novamente.";
}
