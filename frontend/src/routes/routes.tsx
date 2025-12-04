import { createBrowserRouter } from "react-router-dom";
import App from "../App";
import MainLayout from "../layouts/MainLayout";
import Catalog from "../pages/Catalog";
import Login from "../pages/auth/LoginPage";
import RegisterPage from "../pages/auth/RegisterPage";
import ProtectedRoute from "./ProtectedRoute";
import ConsultantDashboard from "../pages/consultant/ConsultantDashboard";
import DashboardPage from "../pages/admin/DashboardPage";
import CompaniesPage from "../pages/admin/CompaniesPage";
import SpecialistsPage from "../pages/admin/SpecialistsPage";
import ConsultantsPage from "../pages/admin/ConsultantsPage";
import ProductsPage from "../pages/specialist/ProductsPage";
import ProductFormPage from "../pages/specialist/ProductFormPage";
import SpecialistDashboard from "../pages/specialist/SpecialistDashboard";

export default function RouterApp() {
  const routerApp = createBrowserRouter([
    { path: "/", element: <App /> },
    {
      path: "/catalog/:category",
      element: (
        <MainLayout>
            <Catalog />
        </MainLayout>
      ),
    },
    {
      path: "/login",
      element: <Login />,
    },
    {
      path: "/register",
      element: <RegisterPage />,
    },
    {
      path: "/consultant/dashboard",
      element: (
        <MainLayout>
          <ProtectedRoute allowedRoles={['CONSULTANT']}>
            <ConsultantDashboard />
          </ProtectedRoute>
        </MainLayout>
      ),
    },
    {
      path: "/admin/dashboard",
      element: (
        <MainLayout>
          <ProtectedRoute allowedRoles={['ADMIN']}>
            <CompaniesPage />
          </ProtectedRoute>
        </MainLayout>
      ),
    },
    {
      path: "/specialist/dashboard",
      element: (
        <MainLayout>
          <ProtectedRoute allowedRoles={['SPECIALIST']}>
            <SpecialistDashboard />
          </ProtectedRoute>
        </MainLayout>
      ),
    },
    {
      path: "/admin/dashboard",
      element: (
        <MainLayout>
          {" "}
          <DashboardPage />{" "}
        </MainLayout>
      ),
    },
    {
      path: "/admin/companies",
      element: (
        <MainLayout>
          {" "}
          <CompaniesPage />{" "}
        </MainLayout>
      ),
    },
    {
      path: "/admin/specialists",
      element: (
        <MainLayout>
          {" "}
          <SpecialistsPage />{" "}
        </MainLayout>
      ),
    },
    {
      path: "/admin/consultants",
      element: (
        <MainLayout>
          {" "}
          <ConsultantsPage />{" "}
        </MainLayout>
      ),
    },
    {
      path: "/specialist/products",
      element: (
        <MainLayout>
          <ProtectedRoute allowedRoles={['SPECIALIST']}>
            <ProductsPage />
          </ProtectedRoute>
        </MainLayout>
      ),
    },
    {
      path: "/specialist/products/new",
      element: (
        <MainLayout>
          <ProtectedRoute allowedRoles={['SPECIALIST']}>
            <ProductFormPage />
          </ProtectedRoute>
        </MainLayout>
      ),
    },
    {
      path: "/specialist/products/edit/:productType/:id",
      element: (
        <MainLayout>
          <ProtectedRoute allowedRoles={['SPECIALIST']}>
            <ProductFormPage />
          </ProtectedRoute>
        </MainLayout>
      ),
    },
  ]);

  return routerApp;
}
