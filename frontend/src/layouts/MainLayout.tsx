import React from "react";
import Sidebar from "../components/Sidebar";

interface MainLayoutProps {
    children: React.ReactNode
}

export default function MainLayout( {children} : MainLayoutProps){
    return(
        <>
            <header className="w-full flex justify-center h-24 bg-background-secondary">
            </header>

            <div className="flex justify-center">
                <Sidebar />
                <main className="flex flex-1 mx-34 my-8">
                    {children}
                </main>
            </div>
        </>

    )
}