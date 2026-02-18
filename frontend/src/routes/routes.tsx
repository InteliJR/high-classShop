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
import SettingsPage from "../pages/admin/SettingsPage";
import MyCompanyPage from "../pages/admin/MyCompanyPage";
import ProductsPage from "../pages/specialist/ProductsPage";
import ProductFormPage from "../pages/specialist/ProductFormPage";
import SpecialistDashboard from "../pages/specialist/SpecialistDashboard";
import CreateContractPage from "../pages/specialist/CreateContractPage";
import ContractPreviewCallback from "../pages/specialist/ContractPreviewCallback";
import ProcessesPage from "../pages/specialist/ProcessesPage";
import CustomerHomePage from "../pages/customer/CustomerHomePage";
import ConsultoriaPage from "../pages/customer/ConsultoriaPage";
import ProfilePage from "../pages/ProfilePage";
import ProductPage from "../pages/ProductPage";
import CustomerProcessesPage from "../pages/customer/CustomerProcessesPage";
import NegotiationPage from "../pages/negotiation/NegotiationPage";

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
    // Customer routes
    {
      path: "/customer/home",
      element: (
        <MainLayout>
          <ProtectedRoute allowedRoles={["CUSTOMER"]}>
            <CustomerHomePage />
          </ProtectedRoute>
        </MainLayout>
      ),
    },
    {
      path: "/customer/consultoria",
      element: (
        <MainLayout>
          <ProtectedRoute allowedRoles={["CUSTOMER"]}>
            <ConsultoriaPage />
          </ProtectedRoute>
        </MainLayout>
      ),
    },
    {
      path: "/customer/processes",
      element: (
        <MainLayout>
          <ProtectedRoute allowedRoles={["CUSTOMER"]}>
            <CustomerProcessesPage />
          </ProtectedRoute>
        </MainLayout>
      ),
    },
    // Profile route (all authenticated users)
    {
      path: "/profile",
      element: (
        <MainLayout>
          <ProtectedRoute
            allowedRoles={["CUSTOMER", "CONSULTANT", "SPECIALIST", "ADMIN"]}
          >
            <ProfilePage />
          </ProtectedRoute>
        </MainLayout>
      ),
    },
    // Product detail page (public)
    {
      path: "/catalog/:productType/:id",
      element: (
        <MainLayout>
          <ProductPage />
        </MainLayout>
      ),
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
            <SpecialistDashboard />
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
    {
      path: "/admin/settings",
      element: (
        <MainLayout>
          <ProtectedRoute allowedRoles={["ADMIN"]}>
            <SettingsPage />
          </ProtectedRoute>
        </MainLayout>
      ),
    },
    {
      path: "/admin/my-company",
      element: (
        <MainLayout>
          <ProtectedRoute allowedRoles={["ADMIN"]}>
            <MyCompanyPage />
          </ProtectedRoute>
        </MainLayout>
      ),
    },
    {
      path: "/specialist/products",
      element: (
        <MainLayout>
          <ProtectedRoute allowedRoles={["SPECIALIST"]}>
            <ProductsPage />
          </ProtectedRoute>
        </MainLayout>
      ),
    },
    {
      path: "/specialist/products/new",
      element: (
        <MainLayout>
          <ProtectedRoute allowedRoles={["SPECIALIST"]}>
            <ProductFormPage />
          </ProtectedRoute>
        </MainLayout>
      ),
    },
    {
      path: "/specialist/products/edit/:productType/:id",
      element: (
        <MainLayout>
          <ProtectedRoute allowedRoles={["SPECIALIST"]}>
            <ProductFormPage />
          </ProtectedRoute>
        </MainLayout>
      ),
    },
    {
      path: "/specialist/contracts/new",
      element: (
        <MainLayout>
          <ProtectedRoute allowedRoles={["SPECIALIST"]}>
            <CreateContractPage />
          </ProtectedRoute>
        </MainLayout>
      ),
    },
    {
      path: "/specialist/contracts/preview-callback",
      element: <ContractPreviewCallback />,
    },
    {
      path: "/specialist/processes",
      element: (
        <MainLayout>
          <ProtectedRoute allowedRoles={["SPECIALIST"]}>
            <ProcessesPage />
          </ProtectedRoute>
        </MainLayout>
      ),
    },
    // Negotiation page (accessible by customers and specialists)
    {
      path: "/processes/:processId/negotiation",
      element: (
        <MainLayout>
          <ProtectedRoute allowedRoles={["CUSTOMER", "SPECIALIST"]}>
            <NegotiationPage />
          </ProtectedRoute>
        </MainLayout>
      ),
    },
  ]);

  return routerApp;
}
