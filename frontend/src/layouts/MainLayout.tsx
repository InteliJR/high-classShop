import React from "react";
import Header from "./Header";
import Sidebar from "./Sidebar";
import { AppProvider } from "../contexts/AppContext";

interface MainLayoutProps {
  children: React.ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  return (
    <>
      <AppProvider>
        <Header />
        <Sidebar />
      </AppProvider>
      <div className="flex justify-center">
        {/* <aside className="w-31 bg-black h-screen"></aside> */}
        <main className="flex flex-col flex-1 mx-4 sm:mx-34 my-8">{children}</main>
      </div>
    </>
  );
}
