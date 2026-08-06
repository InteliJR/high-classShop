import React, { createContext, useEffect, useState } from "react";
import { readSidebarCollapsed, writeSidebarCollapsed } from "../lib/sidebar-collapse-storage";

export const AppContext = createContext<AppContextProps>({} as AppContextProps);

export interface AppContextProps {
  isSidebarCollapsed: boolean;
  setSidebarCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  isSidebarDesktopCollapsed: boolean;
  toggleSidebarDesktopCollapsed: () => void;
  searchTerm: string;
  setSearchTerm: React.Dispatch<React.SetStateAction<string>>;
}

export const AppProvider = ({ children }: { children: React.ReactNode }) => {
  const [isSidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [isSidebarDesktopCollapsed, setSidebarDesktopCollapsed] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Lê a preferência salva no mount. AppProvider remonta a cada navegação
  // (MainLayout envolve cada rota individualmente em routes.tsx), então isso
  // roda de novo a cada troca de página — é o comportamento esperado.
  useEffect(() => {
    setSidebarDesktopCollapsed(readSidebarCollapsed(localStorage));
  }, []);

  const toggleSidebarDesktopCollapsed = () => {
    setSidebarDesktopCollapsed((prev) => {
      const next = !prev;
      writeSidebarCollapsed(localStorage, next);
      return next;
    });
  };

  return (
    <AppContext.Provider
      value={{
        isSidebarCollapsed,
        setSidebarCollapsed,
        isSidebarDesktopCollapsed,
        toggleSidebarDesktopCollapsed,
        searchTerm,
        setSearchTerm,
      }}
    >
      <>{children}</>
    </AppContext.Provider>
  );
};
