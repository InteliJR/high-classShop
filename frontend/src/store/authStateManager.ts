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
}

export const useAuth = create<AuthState>((set) => ({
  accessToken: null,

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
    try{
        const response = await api.post('auth/refresh', {}, {withCredentials: true});
        const accessToken = response.data.data.access_token;
        set({accessToken: accessToken});

    } catch {
        set({accessToken: null});

    }
  },
}));
