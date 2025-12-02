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
import HomePage from "../pages/HomePage";
import CustomerHomePage from "../pages/customer/CustomerHomePage";
import ConsultoriaPage from "../pages/customer/ConsultoriaPage";

export default function RouterApp() {
  const routerApp = createBrowserRouter([
    { path: "/", element: <HomePage /> },
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
    // Customer routes
    {
      path: "/customer/home",
      element: (
        <MainLayout>
          <ProtectedRoute allowedRoles={['CUSTOMER']}>
            <CustomerHomePage />
          </ProtectedRoute>
        </MainLayout>
      ),
    },
    {
      path: "/customer/consultoria",
      element: (
        <MainLayout>
          <ProtectedRoute allowedRoles={['CUSTOMER']}>
            <ConsultoriaPage />
          </ProtectedRoute>
        </MainLayout>
      ),
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
