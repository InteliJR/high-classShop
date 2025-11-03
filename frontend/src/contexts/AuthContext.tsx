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
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<UserProps | null>(null);
  const [accessToken, setAccessToken] = useState(
    localStorage.getItem("highClassShop") || ""
  );
  const [loading, setLoading] = useState<boolean>(true);

  console.log("User sendo renderizado: ", user);

  // Verificar se há um token no navegador
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);

    if (!token) {
      setLoading(false);
      return;
    }

    // Validar o token
    const verifyToken = async () => {
      try {
        const response = await api.get<UserProps>("auth/me", {
          withCredentials: true,
        });
        const data = response.data;
        console.log("Usuário que será setado: ", data);
        setUser(data);
      } catch (error) {
        console.log("Ocorreu esse erro na verificação do token: ", error);
      } finally {
        setLoading(false);
      }
    };

    verifyToken();
  }, []);

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
        localStorage.setItem("highClassShop", data.accessToken);
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
    localStorage.removeItem("highClassShop");
  };

  return (
    <AuthContext.Provider value={{ accessToken, user, login, logout, loading }}>
      <>{children}</>
    </AuthContext.Provider>
  );
};
