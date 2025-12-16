  import React, { useContext } from "react";
  import Header from "./Header";
  import Sidebar from "./Sidebar";
  import { AppContext, AppProvider } from "../contexts/AppContext";
  import { SearchProvider } from "../contexts/SearchContext";
  import { useIsMobile } from "../hooks/use-is-mobile";
  import { AuthContext } from "../contexts/AuthContext";

  interface MainLayoutProps {
    children: React.ReactNode;
  }

  export default function MainLayout({ children }: MainLayoutProps) {
    const { isSidebarCollapsed } = useContext(AppContext);
    const { user } = useContext(AuthContext);
    const isMobile = useIsMobile();

    // margem de respiro quando NÃO tem sidebar
    const desktopPadding = user ? "" : "px-44"; 
    const mobilePadding = user ? "" : "px-4"; // 16px no mobile para não quebrar

    return (
      <AppProvider>
        <SearchProvider>
          <div className="flex flex-col min-h-screen">
            <Header />

            <div className="flex flex-1 h-full">
              {/* Sidebar só aparece se houver usuário  ou tiver no mobile*/}
              {(isMobile || user) && <Sidebar />}

              <main
                className={`
                  flex flex-col flex-1 my-8 transition-all duration-300 
                  ${user ? "mx-4 sm:mx-8" : ""}
                  ${
                    user
                      ? "justify-start"
                      : "justify-start sm:justify-center items-center"
                  }
                  
                  /* Respiro quando não tem sidebar */
                  ${user ? "" : `${isMobile ? mobilePadding : desktopPadding}`}
                  
                  /* Espaço quando sidebar está expandida */
                  ${user && !isMobile && !isSidebarCollapsed ? "pl-94 pr-30" : ""}
                `}
              >
                {children}
              </main>
            </div>
          </div>
        </SearchProvider>
      </AppProvider>
    );
  }
