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
      !original.url.includes("auth/refresh") &&
      !original.url.includes("auth/me")
    ) {
      original._retry = true;

      // Pega o token caso tenha o refreshToken.
      try {
        await refresh();
        const token = useAuth.getState().accessToken;
        if (!token) {
          throw new Error('Failed to refresh token');
        }
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      } catch (refreshError) {
        clearAccessToken();
        clearUser();
        window.location.href = "/login";
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(err);
  }
);

export default api;
