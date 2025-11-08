import { createBrowserRouter } from "react-router-dom";
import App from "../App";
import MainLayout from "../layouts/MainLayout";
import Catalog from "../pages/Catalog";
import Login from "../pages/auth/LoginPage";
import { AuthProvider } from "../contexts/AuthContext";
import ProtectedRoute from "./ProtectedRoute";
import { CookiesProvider } from "react-cookie";

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
  ]);

  return routerApp;
}
