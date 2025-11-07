import { create } from "zustand";
import type { UserProps } from "../types/types";

interface AuthState {
  accessToken: string | null;
  setAccessToken: (token: string) => void;
  clearAccessToken: () => void;
  user: UserProps | null;
  setUser: (user: UserProps | null) => void;
  clearUser: () => void;
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
}));
