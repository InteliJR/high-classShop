import axios from "axios";
import { useAuth } from "../store/authStateManager";

// Instanciar a origem das rquisições para a api
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api/",
});

// Adiciona token de acesso no header das requisições
api.interceptors.request.use((config) => {
  const token = useAuth.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // Sempre incluir cookies nas requisições
  config.withCredentials = true;

  return config;
});

// Renova token em 401; converte erros HTTP em mensagens amigáveis
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;
    const { refresh, clearAccessToken, clearUser } = useAuth.getState();

    if (
      err.response?.status === 401 &&
      !original._retry &&
      !original.url?.includes("auth/refresh")
    ) {
      original._retry = true;
      try {
        await refresh();
        const token = useAuth.getState().accessToken;
        if (!token) throw new Error("Failed to refresh token");
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      } catch (refreshError) {
        clearAccessToken();
        clearUser();
        return Promise.reject(refreshError);
      }
    }

    // Enriquecer erro com mensagem amigável ao usuário
    const status = err.response?.status;
    const serverMessage: string | undefined =
      err.response?.data?.message ||
      err.response?.data?.error ||
      err.response?.data?.details?.hint;

    const isAuthEndpoint =
      original?.url?.includes("/auth/login") ||
      original?.url?.includes("/auth/register");

    if (!err.friendlyMessage) {
      if (status === 400) {
        err.friendlyMessage =
          serverMessage && !isAuthEndpoint
            ? serverMessage
            : "Dados inválidos. Verifique os campos e tente novamente.";
      } else if (status === 401) {
        // Nunca revelar se e-mail existe ou não
        err.friendlyMessage = "Credenciais inválidas. Verifique e tente novamente.";
      } else if (status === 403) {
        err.friendlyMessage = "Você não tem permissão para realizar esta ação.";
      } else if (status === 404) {
        err.friendlyMessage = "O recurso solicitado não foi encontrado.";
      } else if (status === 409) {
        err.friendlyMessage =
          serverMessage && !isAuthEndpoint
            ? serverMessage
            : "Conflito: o registro já existe.";
      } else if (status && status >= 500) {
        err.friendlyMessage =
          "Serviço temporariamente indisponível. Tente novamente em instantes.";
      } else if (!status) {
        err.friendlyMessage =
          "Não foi possível conectar ao servidor. Verifique sua conexão.";
      }
    }

    return Promise.reject(err);
  },
);

export default api;
