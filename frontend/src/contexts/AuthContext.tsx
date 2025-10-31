import { createContext, useState } from "react";
import type { LoginValues, UserProps } from "../types/types";
import api from "../services/api";
import { useNavigate } from "react-router-dom";

export const AuthContext = createContext<AuthContextProps>(
  {} as AuthContextProps
);

export interface AuthContextProps {
  token: string;
  user: UserProps | null;
  login: (user: LoginValues) => void;
  logout: () => void;
  loading: boolean;
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<UserProps | null>(null);
  const [token, setToken] = useState(localStorage.getItem("site") || "");
  const [loading, setLoading] = useState<boolean>(true);
  const navigate = useNavigate();

  const login = async (user: LoginValues) => {
    setLoading(true);
    //Verificae se o usuário já possui o token de acesso
    if (token == "") {
      setLoading(false);
      return;
    }
    try {
      // Realizar o login fazendo a req para o backend
      const response: any = await api.post("auth/login", {
        email: user.email,
        password: user.password,
      });
      const data = response.data;
      // Guarda as informações de login no navegador
      if (data) {
        setUser(data.user);
        setToken(data.accessToken);
        localStorage.setItem("highClassShop", data.accessToken);
        navigate("/");
        setLoading(false);
        return;
      }
      setLoading(false);
      throw new Error(response.statusText);
    } catch (error) {
      setLoading(false);
      console.error("Ocorreu um erro durante o login: ", error);
    }
  };  

  // Logout do usuário
  const logout = () => {
    setUser(null);
    setToken("");
    localStorage.removeItem("highClassShop");
    navigate("/login");
    setLoading(false);
  };

  return (
    <AuthContext.Provider value={{ token, user, login, logout, loading }}>
      <>{children}</>
    </AuthContext.Provider>
  );
};
