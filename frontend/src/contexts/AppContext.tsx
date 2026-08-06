import React, { createContext, useState } from "react";
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
  // Lazy initializer: lê a preferência salva de forma síncrona, antes do
  // primeiro paint, para evitar o sidebar "piscar" aberto e depois colapsar.
  const [isSidebarDesktopCollapsed, setSidebarDesktopCollapsed] = useState<boolean>(
    () => readSidebarCollapsed(localStorage),
  );
  const [searchTerm, setSearchTerm] = useState<string>("");

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
