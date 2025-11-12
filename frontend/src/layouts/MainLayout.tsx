import React from "react";
import Header from "./Header";

interface MainLayoutProps {
  children: React.ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  return (
    <>
      <Header />
      <div className="flex justify-center">
        {/* <aside className="w-31 bg-black h-screen"></aside> */}
        <main className="flex flex-col flex-1 mx-34 my-8">
          {children}
        </main>
      </div>
    </>
  );
}
