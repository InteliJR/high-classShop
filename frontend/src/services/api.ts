import axios from "axios";
import { useAuth } from "../store/authStateManager";

// Instanciar a origem das rquisições para a api
const api = axios.create({
  baseURL: "http://localhost:3000/api/",
});

// Adiciona token de acesso no header das requisições
api.interceptors.request.use((config) => {
  const token = useAuth.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

// Pega o accessToken caso o usuário possua refreshToken, a partir da análise do erro 401 unathorized
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;
    const { refresh, clearAccessToken, clearUser } = useAuth.getState();

    // Pega a response com o erro 401 com condições para não entrar em loop infinito
    if (
      err.response?.status === 401 &&
      !original._retry &&
      !original.url.includes("auth/refresh")
    ) {
      original._retry = true;

      // Verifica se existe o refreshToken
      try {
        // Se existir ele carrega o novo accessToken
        await refresh();
        const token = useAuth.getState().accessToken;
        if (!token) {
          throw new Error('Failed to refresh token');
        }
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      } catch (refreshError) {
        // Em caso de erro, ele manda para o AuthContext informando a falha
        clearAccessToken();
        clearUser();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(err);
  }
);

export default api;
