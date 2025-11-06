import { createContext, useEffect, useState } from "react";
import type { LoginValues, UserProps } from "../types/types";
import api from "../services/api";

export const AuthContext = createContext<AuthContextProps>(
  {} as AuthContextProps
);

export interface AuthContextProps {
  accessToken: string;
  user: UserProps | null;
  login: (user: LoginValues) => void;
  logout: () => void;
  loading: boolean;
  refreshUser: () => Promise<boolean>;
  verifyToken: () => Promise<boolean>;
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<UserProps | null>(null);
  const [accessToken, setAccessToken] = useState(
    localStorage.getItem("acessToken") || ""
  );
  const [loading, setLoading] = useState<boolean>(true);

  // Verificar se há um token no navegador
  useEffect(() => {
    const token = localStorage.getItem("accessToken");

    const init = async () => {
      if (!token) {
        const refreshed = await refreshUser();
        if(!refreshed){
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
      if (accessToken !== "") {
        return await refreshUser();
      }
      console.log("Ocorreu o seguinte erro na verificação do token: ", error);
      return false;
    } finally {
      setLoading(false);
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
      localStorage.setItem("accessToken", data.access_token);
      setUser(data.user);
      return true;
    } catch (error) {
      return false;
    }
  };

  // Possibilitar o login na plataforma
  const login = async (user: LoginValues) => {
    //Verificar se o usuário já possui o accessToken de acesso
    if (accessToken !== "") {
      setLoading(false);
      return;
    }
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
        localStorage.setItem("accessToken", data.access_token);
        setLoading(false);
        return data;
      }
      setLoading(false);
      throw new Error(response.statusText);
    } catch (error) {
      setLoading(false);
      console.error("Ocorreu um erro durante o login: ", error);
      throw error;
    }
  };

  // Logout do usuário
  const logout = () => {
    setUser(null);
    setAccessToken("");
    localStorage.setItem("accessToken", "");
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
