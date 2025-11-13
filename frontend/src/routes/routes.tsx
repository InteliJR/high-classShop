import { createBrowserRouter } from "react-router-dom";
import App from "../App";
import MainLayout from "../layouts/MainLayout";
import Catalog from "../pages/Catalog";
import Login from "../pages/auth/LoginPage";
import { AuthProvider } from "../contexts/AuthContext";
import ProtectedRoute from "./ProtectedRoute";
import { CookiesProvider } from "react-cookie";
import DashboardPage from "../pages/admin/DashboardPage";
import CompaniesPage from "../pages/admin/CompaniesPage";
import SpecialistsPage from "../pages/admin/SpecialistsPage";
import ConsultantsPage from "../pages/admin/ConsultantsPage";

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
  ]);

  return routerApp;
}
