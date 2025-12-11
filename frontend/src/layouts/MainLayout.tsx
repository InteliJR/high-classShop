import React, { useContext } from "react";
import Header from "./Header";
import Sidebar from "./Sidebar";
import { AppContext, AppProvider } from "../contexts/AppContext";
import { SearchProvider } from "../contexts/SearchContext";
import { useIsMobile } from "../hooks/use-is-mobile";

interface MainLayoutProps {
  children: React.ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  const {isSidebarCollapsed} = useContext(AppContext);
  const isMobile = useIsMobile();
  return (
    <>
      <AppProvider>
        <SearchProvider>
          <div className="flex flex-col">
            <Header />
            <div className="flex justify-center h-full">
              <Sidebar />
              <main className={`flex flex-col flex-1 mx-4 sm:mx-34 my-8 ${!isMobile && !isSidebarCollapsed && "pl-64"}`} >
                {children}
              </main>
            </div>
          </div>
        </SearchProvider>
      </AppProvider>
    </>
  );
}
