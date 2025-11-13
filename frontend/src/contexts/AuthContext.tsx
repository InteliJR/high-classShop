import { createContext, useEffect, useRef, useState } from "react";
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
  const isInitialized = useRef(false);

  const { setAccessToken, setUser, clearAccessToken, clearUser } = useAuth.getState();

  useEffect(() => {
    if (isInitialized.current) return;
    isInitialized.current = true;
    
    const init = async () => {
      const isValid = await verifyToken();
      
      if (!isValid) {
        clearAccessToken();
        clearUser();
      }
      
      setLoading(false);
    };

    init();
  }, []);

  const verifyToken = async () => {
    try {
      const response = await api.get<UserProps>("auth/me", {
        withCredentials: true,
      });
      const data = response.data;
      setUser(data);
      return true;
    } catch (error) {
      const currentUser = useAuth.getState().user;
      if (currentUser) {
        setUser(currentUser);
        return true;
      }
      return false;
    }
  };

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
