import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import MainLayout from './layouts/MainLayout.tsx'
import Catalog from './pages/Catalog.tsx'
import CompaniesPage from './pages/admin/CompaniesPage.tsx'
import SpecialistsPage from './pages/admin/SpecialistsPage.tsx'
import ConsultantsPage from './pages/admin/ConsultantsPage.tsx'
import DashboardPage from './pages/admin/DashboardPage.tsx'

const router = createBrowserRouter([
  {path:"/", element: <App/>},
  {path: "/catalog/:category", element: <MainLayout> <Catalog /> </MainLayout>},
  {path: "/admin/dashboard", element: <MainLayout> <DashboardPage /> </MainLayout>},
  {path: "/admin/companies", element: <MainLayout> <CompaniesPage /> </MainLayout>},
  {path: "/admin/specialists", element: <MainLayout> <SpecialistsPage /> </MainLayout>},
  {path: "/admin/consultants", element: <MainLayout> <ConsultantsPage /> </MainLayout>},
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router = {router} />
  </StrictMode>,
)
