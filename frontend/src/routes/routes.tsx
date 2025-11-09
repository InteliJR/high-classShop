import { createBrowserRouter } from "react-router-dom";
import App from "../App";
import MainLayout from "../layouts/MainLayout";
import Catalog from "../pages/Catalog";
import Login from "../pages/auth/LoginPage";
import ProtectedRoute from "./ProtectedRoute";
import ConsultantDashboard from "../pages/consultant/ConsultantDashboard";
import CompaniesPage from "../pages/admin/CompaniesPage";

export default function RouterApp() {
  const routerApp = createBrowserRouter([
    { path: "/", element: <App /> },
    {
      path: "/catalog/:category",
      element: (
        <MainLayout>
          <ProtectedRoute>
            <Catalog />
          </ProtectedRoute>
        </MainLayout>
      ),
    },
    {
      path: "/login",
      element: <Login />,
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
            <Catalog />
          </ProtectedRoute>
        </MainLayout>
      ),
    },
  ]);

  return routerApp;
}
