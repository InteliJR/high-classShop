import { createBrowserRouter } from "react-router-dom";
import App from "../App";
import MainLayout from "../layouts/MainLayout";
import Catalog from "../pages/Catalog";
import Login from "../pages/auth/LoginPage";
import { AuthProvider } from "../contexts/AuthContext";
import ProtectedRoute from "./ProtectedRoute";
import { CookiesProvider } from "react-cookie";
import ConsultantDashboard from "../pages/consultant/ConsultantDashboard";
import CompaniesPage from "../pages/admin/CompaniesPage";

export default function RouterApp() {
  const routerApp = createBrowserRouter([
    { path: "/", element: <App /> },
    {
      path: "/catalog/:category",
      element: (
        <MainLayout>
          <CookiesProvider>
            <AuthProvider>
              <ProtectedRoute>
                {" "}
                <Catalog />{" "}
              </ProtectedRoute>
            </AuthProvider>
          </CookiesProvider>
        </MainLayout>
      ),
    },
    {
      path: "/login",
      element: (
        <CookiesProvider>
          <AuthProvider>
            {" "}
            <Login />{" "}
          </AuthProvider>
        </CookiesProvider>
      ),
    },
    {
      path: "/consultant/dashboard",
      element: (
        <MainLayout>
          <CookiesProvider>
            <AuthProvider>
              <ProtectedRoute allowedRoles={['CONSULTANT']}>
                <ConsultantDashboard />
              </ProtectedRoute>
            </AuthProvider>
          </CookiesProvider>
        </MainLayout>
      ),
    },
    {
      path: "/admin/dashboard",
      element: (
        <MainLayout>
          <CookiesProvider>
            <AuthProvider>
              <ProtectedRoute allowedRoles={['ADMIN']}>
                <CompaniesPage />
              </ProtectedRoute>
            </AuthProvider>
          </CookiesProvider>
        </MainLayout>
      ),
    },
    {
      path: "/specialist/dashboard",
      element: (
        <MainLayout>
          <CookiesProvider>
            <AuthProvider>
              <ProtectedRoute allowedRoles={['SPECIALIST']}>
                <Catalog />
              </ProtectedRoute>
            </AuthProvider>
          </CookiesProvider>
        </MainLayout>
      ),
    },
  ]);

  return routerApp;
}
