import { create } from "zustand";
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

export const useAuth = create<AuthState>((set, get) => ({
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

  refresh: async() => {
    const state = get();
    
    // Se já está fazendo refresh, aguarda a promessa existente
    if (state.isRefreshing && state.refreshPromise) {
      return state.refreshPromise;
    }

    // Marca como refreshing e cria nova promessa
    const refreshPromise = (async () => {
      try {
        const response = await api.post('auth/refresh', {}, {withCredentials: true});
        const data = response.data.data;
        set({ 
          accessToken: data.access_token, 
          user: data.user,
          isRefreshing: false, 
          refreshPromise: null 
        });
      } catch {
        set({ accessToken: null, user: null, isRefreshing: false, refreshPromise: null });
      }
    })();

    set({ isRefreshing: true, refreshPromise });
    return refreshPromise;
  },
}));
