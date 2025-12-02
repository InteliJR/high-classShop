import React, { createContext, useState } from "react";

export const AppContext = createContext<AppContextProps>({} as AppContextProps);

export interface AppContextProps {
  isSidebarCollapsed: boolean;
  setSidebarCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
}

export const AppProvider = ({ children }: { children: React.ReactNode }) => {
  const [isSidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);

  return (
    <AppContext.Provider value={{ isSidebarCollapsed, setSidebarCollapsed }}>
      <>{children}</>
    </AppContext.Provider>
  );
};
