import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { UserProps } from "../types/types";
import api from "../services/api";

interface AuthState {
  accessToken: string | null;
  setAccessToken: (token: string) => void;
  clearAccessToken: () => void;
  user: UserProps | null;
  setUser: (user: UserProps | null) => void;
  clearUser: () => void;
  refresh: () => Promise<void>;
  isRefreshing: boolean;
  refreshPromise: Promise<void> | null;
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      isRefreshing: false,
      refreshPromise: null,

      setAccessToken: (token) => {
        set({ accessToken: token });
      },

      clearAccessToken: () => {
        set({ accessToken: null });
      },

      user: null,

      setUser: (user) => {
        set({ user: user });
      },

      clearUser: () => {
        set({ user: null });
      },

      refresh: async () => {
        const state = get();

        // Se já está fazendo refresh, aguarda a promessa existente
        if (state.isRefreshing && state.refreshPromise) {
          return state.refreshPromise;
        }

        // Marca como refreshing e cria nova promessa
        const refreshPromise = (async () => {
          try {
            const response = await api.post(
              "auth/refresh",
              {},
              { withCredentials: true },
            );
            const data = response.data.data;
            set({
              accessToken: data.access_token,
              user: data.user,
              isRefreshing: false,
              refreshPromise: null,
            });
          } catch (error) {
            console.error("Refresh token failed:", error);
            set({
              accessToken: null,
              user: null,
              isRefreshing: false,
              refreshPromise: null,
            });
            // NÃO redirecionar aqui - deixar o ProtectedRoute ou AuthContext lidar com isso
          }
        })();

        set({ isRefreshing: true, refreshPromise });
        return refreshPromise;
      },
    }),
    {
      name: "auth-storage",
      partialize: (state) => ({
        accessToken: state.accessToken,
        user: state.user,
        // Não persiste isRefreshing e refreshPromise
      }),
    },
  ),
);
