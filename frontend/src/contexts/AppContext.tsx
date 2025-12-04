import React, { createContext, useState } from "react";

export const AppContext = createContext<AppContextProps>({} as AppContextProps);

export interface AppContextProps {
  isSidebarCollapsed: boolean;
  setSidebarCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  searchTerm: string;
  setSearchTerm: React.Dispatch<React.SetStateAction<string>>;
}

export const AppProvider = ({ children }: { children: React.ReactNode }) => {
  const [isSidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>("");

  return (
    <AppContext.Provider value={{ isSidebarCollapsed, setSidebarCollapsed, searchTerm, setSearchTerm }}>
      <>{children}</>
    </AppContext.Provider>
  );
};
