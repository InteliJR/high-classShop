import { createBrowserRouter } from "react-router-dom";
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

export default function RouterApp() {
  const routerApp = createBrowserRouter([
    { path: "/", element: <Login /> },
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
          <ProtectedRoute allowedRoles={["CONSULTANT"]}>
            <ConsultantDashboard />
          </ProtectedRoute>
        </MainLayout>
      ),
    },
    {
      path: "/admin/dashboard",
      element: (
        <MainLayout>
          <ProtectedRoute allowedRoles={["ADMIN"]}>
            <DashboardPage />
          </ProtectedRoute>
        </MainLayout>
      ),
    },
    {
      path: "/specialist/dashboard",
      element: (
        <MainLayout>
          <ProtectedRoute allowedRoles={["SPECIALIST"]}>
            <Catalog />
          </ProtectedRoute>
        </MainLayout>
      ),
    },
    {
      path: "/admin/companies",
      element: (
        <MainLayout>
          <ProtectedRoute allowedRoles={["ADMIN"]}>
            <CompaniesPage />
          </ProtectedRoute>
        </MainLayout>
      ),
    },
    {
      path: "/admin/specialists",
      element: (
        <MainLayout>
          <ProtectedRoute allowedRoles={["ADMIN"]}>
            <SpecialistsPage />
          </ProtectedRoute>
        </MainLayout>
      ),
    },
    {
      path: "/admin/consultants",
      element: (
        <MainLayout>
          <ProtectedRoute allowedRoles={["ADMIN"]}>
            <ConsultantsPage />
          </ProtectedRoute>
        </MainLayout>
      ),
    },
  ]);

  return routerApp;
}
