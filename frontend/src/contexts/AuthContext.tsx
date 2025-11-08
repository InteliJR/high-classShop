import { createContext, useEffect, useState } from "react";
import type { LoginValues, UserProps } from "../types/types";
import api from "../services/api";
import { useAuth } from "../store/authStateManager";

export const AuthContext = createContext<AuthContextProps>(
  {} as AuthContextProps
);

export interface AuthContextProps {
  accessToken: string | null;
  user: UserProps | null;
  login: (user: LoginValues) => Promise<{ user: UserProps; access_token: string }>;
  logout: () => void;
  loading: boolean;
  refreshUser: () => Promise<boolean>;
  verifyToken: () => Promise<boolean>;
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [loading, setLoading] = useState<boolean>(true);

  const accessToken = useAuth((state) => state.accessToken);
  const user = useAuth((state) => state.user);

  const setAccessToken = useAuth((state) => state.setAccessToken);
  const setUser = useAuth((state) => state.setUser);

  const clearAccessToken = useAuth((state) => state.clearAccessToken);
  const clearUser = useAuth((state) => state.clearUser);


  // Verificar se há um token no navegador
  useEffect(() => {
    const init = async () => {
      const token = useAuth.getState().accessToken;
      if (!token) {
        const refreshed = await refreshUser();
        if (!refreshed) {
          setLoading(false);
          return;
        }
      }
      await verifyToken();
      setLoading(false);
    };

    init();
  }, []);

  // Validar o token
  const verifyToken = async () => {
    try {
      const response = await api.get<UserProps>("auth/me", {
        withCredentials: true,
      });
      const data = response.data;
      setUser(data);
      return true;
    } catch (error) {
      // Tentar conseguir o accessToken a partir do refreshToken caso ele exista
      if (accessToken) {
        return await refreshUser();
      }

      return false;
    }
  };

  // Criar o accessToken a partir do refreshToken
  const refreshUser = async () => {
    try {
      const response = await api.post(
        "auth/refresh",
        {},
        { withCredentials: true }
      );
      const data = response.data.data;
      setAccessToken(data.access_token);
      setUser(data.user);
      return true;
    } catch (error) {
      return false;
    }
  };

  // Possibilitar o login na plataforma
  const login = async (user: LoginValues) => {
    try {
      // Realizar o login fazendo a req para o backend
      const response: any = await api.post(
        "auth/login",
        {
          email: user.email,
          password: user.password,
        },
        { withCredentials: true }
      );
      const data = response.data.data;
      // Guarda as informações de login no navegador
      if (data) {
        setUser(data.user);
        setAccessToken(data.access_token);
        return data;
      }
      throw new Error(response.statusText);
    } catch (error) {
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Logout do usuário
  const logout = () => {
    clearAccessToken();
    clearUser();
  };

  return (
    <AuthContext.Provider
      value={{
        accessToken,
        user,
        login,
        logout,
        loading,
        refreshUser,
        verifyToken,
      }}
    >
      <>{children}</>
    </AuthContext.Provider>
  );
};
