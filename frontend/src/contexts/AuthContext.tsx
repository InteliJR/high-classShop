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
  const [isInitialized, setIsInitialized] = useState<boolean>(false);

  // Não subscrevemos ao state aqui para evitar re-renders desnecessários
  // Os componentes que precisam de user/accessToken pegam direto do useAuth
  const { setAccessToken, setUser, clearAccessToken, clearUser } = useAuth.getState();


  // Verificar se há um token no navegador
  useEffect(() => {
    if (isInitialized) return; // Evita múltiplas inicializações
    
    const init = async () => {
      // Sempre tenta verificar o token primeiro
      // Se não tiver accessToken, o /auth/me vai dar 401 e o interceptor faz refresh
      const isValid = await verifyToken();
      
      if (!isValid) {
        // Se verifyToken falhou e não conseguiu recuperar via interceptor,
        // limpa os dados
        clearAccessToken();
        clearUser();
      }
      
      setLoading(false);
      setIsInitialized(true);
    };

    init();
  }, [isInitialized]);

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
      // Se o interceptor fez refresh com sucesso, o user já está no store
      const currentUser = useAuth.getState().user;
      if (currentUser) {
        setUser(currentUser);
        return true;
      }
      // Se realmente falhou, retorna false
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
        accessToken: useAuth.getState().accessToken,
        user: useAuth.getState().user,
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
