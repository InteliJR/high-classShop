import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import MainLayout from './layouts/MainLayout.tsx'
import Catalog from './pages/Catalog.tsx'
import Login from './pages/auth/LoginPage.tsx'
import { AuthProvider } from './contexts/AuthContext.tsx'

const router = createBrowserRouter([
  {path:"/", element: <App/>},
  {path: "/catalog/:category", element: <MainLayout> <Catalog /> </MainLayout>},
  {path: "/login", element: <AuthProvider> <Login /> </AuthProvider>}
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router = {router} />
  </StrictMode>,
)
