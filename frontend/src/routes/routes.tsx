import { createBrowserRouter } from "react-router-dom";
import MainLayout from "../layouts/MainLayout";
import Catalog from "../pages/catalog/CatalogPage";
import Login from "../pages/auth/LoginPage";
import ForgotPasswordPage from "../pages/auth/ForgotPasswordPage";
import ResetPasswordPage from "../pages/auth/ResetPasswordPage";
import RegisterPage from "../pages/auth/RegisterPage";
import ProtectedRoute from "./ProtectedRoute";
import ConsultantDashboard from "../pages/consultant/ConsultantDashboard";
import ConsultantClientsPage from "../pages/consultant/ConsultantClientsPage";
import ConsultantProcessesPage from "../pages/consultant/ConsultantProcessesPage";
import ConsultantProcessDetailPage from "../pages/consultant/ConsultantProcessDetailPage";
import RegisterConsultantPage from "../pages/auth/RegisterConsultantPage";
import RegisterSpecialistPage from "../pages/auth/RegisterSpecialistPage";
import DashboardPage from "../pages/admin/DashboardPage";
import CompaniesPage from "../pages/admin/CompaniesPage";
import SpecialistsPage from "../pages/admin/SpecialistsPage";
import SettingsPage from "../pages/admin/SettingsPage";
import MyCompanyPage from "../pages/admin/MyCompanyPage";
import CommissionsPage from "../pages/admin/CommissionsPage";
import DatabasePage from "../pages/admin/DatabasePage";
import ProductsPage from "../pages/specialist/ProductsPage";
import ProductFormPage from "../pages/specialist/ProductFormPage";
import SpecialistDashboard from "../pages/specialist/SpecialistDashboard";
import CreateContractPage from "../pages/specialist/CreateContractPage";
import ContractPreviewCallback from "../pages/specialist/ContractPreviewCallback";
import ProcessesPage from "../pages/specialist/ProcessesPage";
import CustomerHomePage from "../pages/customer/CustomerHomePage";
import ConsultoriaPage from "../pages/customer/ConsultoriaPage";
import ProfilePage from "../pages/profile/ProfilePage";
import ProductPage from "../pages/catalog/ProductPage";
import CustomerProcessesPage from "../pages/customer/CustomerProcessesPage";
import NegotiationPage from "../pages/negotiation/NegotiationPage";
import LandingPage from "../pages/landing-page/LandingPage";
import MeetingRoomPage from "../pages/meetings/MeetingRoomPage";
import AdvisorAcceptPage from "../pages/advisor/AdvisorAcceptPage";
import AdvisorDashboardPage from "../pages/advisor/AdvisorDashboardPage";
import RegisterOfficePage from "../pages/auth/RegisterOfficePage";
import OfficeDashboardPage from "../pages/office/OfficeDashboardPage";
import OfficeConsultantsPage from "../pages/office/OfficeConsultantsPage";
import OfficeClientsPage from "../pages/office/OfficeClientsPage";
import OfficeCompanySettingsPage from "../pages/office/OfficeCompanySettingsPage";

export default function RouterApp() {
  const routerApp = createBrowserRouter([
    { path: "/", element: <LandingPage /> },
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
      path: "/forgot-password",
      element: <ForgotPasswordPage />,
    },
    {
      path: "/reset-password",
      element: <ResetPasswordPage />,
    },
    {
      path: "/register",
      element: <RegisterPage />,
    },
    {
      path: "/register-consultant",
      element: <RegisterConsultantPage />,
    },
    {
      path: "/register-specialist",
      element: <RegisterSpecialistPage />,
    },
    {
      path: "/register-office",
      element: <RegisterOfficePage />,
    },
    // OFFICE routes
    {
      path: "/office/dashboard",
      element: (
        <MainLayout>
          <ProtectedRoute allowedRoles={["OFFICE", "ADMIN"]}>
            <OfficeDashboardPage />
          </ProtectedRoute>
        </MainLayout>
      ),
    },
    {
      path: "/office/consultants",
      element: (
        <MainLayout>
          <ProtectedRoute allowedRoles={["OFFICE", "ADMIN"]}>
            <OfficeConsultantsPage />
          </ProtectedRoute>
        </MainLayout>
      ),
    },
    {
      path: "/office/clients",
      element: (
        <MainLayout>
          <ProtectedRoute allowedRoles={["OFFICE", "ADMIN"]}>
            <OfficeClientsPage />
          </ProtectedRoute>
        </MainLayout>
      ),
    },
    {
      path: "/office/company",
      element: (
        <MainLayout>
          <ProtectedRoute allowedRoles={["OFFICE", "ADMIN"]}>
            <OfficeCompanySettingsPage />
          </ProtectedRoute>
        </MainLayout>
      ),
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
      path: "/consultant/clients",
      element: (
        <MainLayout>
          <ProtectedRoute allowedRoles={["CONSULTANT"]}>
            <ConsultantClientsPage />
          </ProtectedRoute>
        </MainLayout>
      ),
    },
    {
      path: "/consultant/processes",
      element: (
        <MainLayout>
          <ProtectedRoute allowedRoles={["CONSULTANT"]}>
            <ConsultantProcessesPage />
          </ProtectedRoute>
        </MainLayout>
      ),
    },
    {
      path: "/consultant/processes/:processId",
      element: (
        <MainLayout>
          <ProtectedRoute allowedRoles={["CONSULTANT"]}>
            <ConsultantProcessDetailPage />
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
      path: "/admin/commissions",
      element: (
        <MainLayout>
          <ProtectedRoute allowedRoles={["ADMIN"]}>
            <CommissionsPage />
          </ProtectedRoute>
        </MainLayout>
      ),
    },
    {
      path: "/admin/database",
      element: (
        <MainLayout>
          <ProtectedRoute allowedRoles={["ADMIN"]}>
            <DatabasePage />
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
    {
      path: "/processes/:processId/meeting",
      element: (
        <MainLayout>
          <ProtectedRoute allowedRoles={["CUSTOMER", "SPECIALIST", "CONSULTANT"]}>
            <MeetingRoomPage />
          </ProtectedRoute>
        </MainLayout>
      ),
    },
    // Advisor routes
    {
      path: "/advisor/accept",
      element: <AdvisorAcceptPage />,
    },
    {
      path: "/advisor/dashboard",
      element: (
        <MainLayout>
          <ProtectedRoute allowedRoles={["CUSTOMER", "CONSULTANT", "SPECIALIST", "ADMIN"]}>
            <AdvisorDashboardPage />
          </ProtectedRoute>
        </MainLayout>
      ),
    },
  ]);

  return routerApp;
}
