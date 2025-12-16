import { createContext, useEffect, useMemo, useRef, useState } from "react";
import type {
  LoginValues,
  RegisterValues,
  ReferralTokenPayload,
  UserProps,
} from "../types/types";
import api from "../services/api";
import { useAuth } from "../store/authStateManager";

export const AuthContext = createContext<AuthContextProps>(
  {} as AuthContextProps
);

export interface AuthContextProps {
  accessToken: string | null;
  user: UserProps | null;
  login: (
    user: LoginValues
  ) => Promise<{ user: UserProps; access_token: string }>;
  register: (data: RegisterValues) => Promise<{ user: UserProps }>;
  validateReferralToken: (token: string) => Promise<ReferralTokenPayload>;
  logout: () => Promise<void>;
  loading: boolean;
  refreshUser: () => Promise<boolean>;
  verifyToken: () => Promise<boolean>;
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [loading, setLoading] = useState<boolean>(true);
  const isInitialized = useRef(false);
  // Pega as informações guardadas em memória
  const {
    user,
    accessToken,
    setAccessToken,
    setUser,
    clearAccessToken,
    clearUser,
  } = useAuth();

  // Verifica a existência de tokens quando a tela é carregada
  useEffect(() => {
    if (isInitialized.current) return;
    isInitialized.current = true;

    const init = async () => {
      try {
        await verifyToken();
      } finally {
        setLoading(false);
      }
    };

    init();
  }, []);

  // Verifica se o accessToken é válido
  const verifyToken = async () => {
    try {
      const response = await api.get<UserProps>("auth/me", {
        withCredentials: true,
      });
      const data = response.data;
      setUser(data);
      return true;
    } catch (error) {
      clearUser();
      clearAccessToken();
      return false;
    }
  };

  // Recarrega o acessToken e o usuário caso haja algum refreshToken
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
      clearUser();
      clearAccessToken();
      return false;
    }
  };

  // Loga o usuário na plataforma
  const login = async (user: LoginValues) => {
    try {
      const response: any = await api.post(
        "auth/login",
        {
          email: user.email,
          password: user.password,
        },
        { withCredentials: true }
      );
      const data = response.data.data;
      if (data) {
        setAccessToken(data.access_token);
        setUser(data.user);
        return data;
      }
      throw new Error(response.statusText);
    } catch (error) {
      throw error;
    }
  };

  // Registra o usuário na plataforma
  const register = async (data: RegisterValues) => {
    try {
      const response: any = await api.post("auth/register", data, {
        withCredentials: true,
      });
      const responseData = response.data.data;
      if (responseData?.user) {
        return { user: responseData.user };
      }
      throw new Error(response.statusText);
    } catch (error) {
      throw error;
    }
  };

  // Valida o token de convite na API para obter os dados do usuário que enviou o link antes do cadastro
  const validateReferralToken = async (
    token: string
  ): Promise<ReferralTokenPayload> => {
    try {
      const response = await api.post<{ data: ReferralTokenPayload }>(
        "auth/validate-referral",
        { token }
      );
      return response.data.data;
    } catch (error) {
      throw new Error("Token de convite inválido ou expirado");
    }
  };

  // Desloga o usuário da plataforma
  const logout = async () => {
    try {
      await api.post("auth/logout", {}, {withCredentials: true});
    } catch (error) {
      throw error;
    } finally {
      clearAccessToken();
      clearUser();
    }
  };

  // Agrupa os valores de contexto, e os atualiza caso mude alguma das variáveis
  const contextValues = useMemo(
    () => ({
      accessToken,
      user,
      login,
      register,
      validateReferralToken,
      logout,
      loading,
      refreshUser,
      verifyToken,
    }),
    [user, accessToken, loading]
  );

  return (
    <AuthContext.Provider value={contextValues}>
      {loading ? (
        <div className="h-screen w-screen flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 border-4 border-gray-200 border-t-primary rounded-full animate-spin" />
            <p className="text-lg text-gray-600">Carregando...</p>
          </div>
        </div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
};
