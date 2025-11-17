import React from "react";

interface MainLayoutProps {
  children: React.ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  return (
    <>
      <header className="w-full flex justify-center h-24 bg-background-secondary"></header>
      <div className="flex justify-center">
        <aside className="w-31 bg-black h-screen"></aside>
        <main className="flex flex-col flex-1 mx-34 my-8">
          {/* <h1>Context</h1>
                    <p>{user?.name}</p>
                    <button onClick={logout}>Click aqui</button> */}
          {children}
        </main>
      </div>
    </>
  );
}
