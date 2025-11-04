import { createContext, useEffect, useState } from "react";
import type { LoginValues, UserProps } from "../types/types";
import api from "../services/api";
import { TOKEN_KEY } from "../services/authService";

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
    localStorage.getItem("highClassShop") || ""
  );
  const [refreshToken, setRefreshToken] = useState(
    localStorage.getItem("RefreshHCS") || ""
  );
  const [loading, setLoading] = useState<boolean>(true);


  // Verificar se há um token no navegador
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);

    if (!token && !refreshToken) {
      setLoading(false);
      return;
    }

    verifyToken();
  }, []);

  // Validar o token
  const verifyToken = async () => {
    try {
      const response = await api.get<UserProps>("auth/me", {
        withCredentials: true,
      });
      const data = response.data;
      console.log("Usuário que será setado: ", data);
      setUser(data);
      return true;
    } catch (error) {
      console.log("Ocorreu esse erro na verificação do token: ", error);
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Criar o accessToken a partir do refreshToken
  const refreshUser = async () => {
    console.log("Fazendo o refresh");
    try {
      const response = await api.post(
        "auth/refresh",
        {
          body: refreshToken,
        },
        { withCredentials: true }
      );
      const data = response.data;

      setAccessToken(data.accessToken);
      setUser(data.user);
      setLoading(false);
      return true;
    } catch (error) {
      setLoading(false);
      return false;
    }
  };

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
      const data = response.data;
      // Guarda as informações de login no navegador
      if (data) {
        setUser(data.user);
        setAccessToken(data.accessToken);
        setRefreshToken(data.refreshToken);
        localStorage.setItem("highClassShop", data.accessToken);
        localStorage.setItem("RefreshHCS", data.refreshToken);
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
    setRefreshToken("");
    localStorage.removeItem("highClassShop");
    localStorage.removeItem("RefreshHCS");
  };

  return (
    <AuthContext.Provider value={{ accessToken, user, login, logout, loading, refreshUser, verifyToken }}>
      <>{children}</>
    </AuthContext.Provider>
  );
};
