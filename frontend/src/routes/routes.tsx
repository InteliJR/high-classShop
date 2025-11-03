import { createBrowserRouter } from "react-router-dom";
import App from "../App";
import MainLayout from "../layouts/MainLayout";
import Catalog from "../pages/Catalog";
import Login from "../pages/auth/LoginPage";
import { AuthProvider } from "../contexts/AuthContext";
import ProtectedRoute from "./ProtectedRoute";

export default function RouterApp() {
  const routerApp = createBrowserRouter([
    { path: "/", element: <App /> },
    {
      path: "/catalog/:category",
      element: (
        <MainLayout>
          <AuthProvider>
            <ProtectedRoute>
              {" "}
              <Catalog />{" "}
            </ProtectedRoute>
          </AuthProvider>
        </MainLayout>
      ),
    },
    {
      path: "/login",
      element: (
        <AuthProvider>
          {" "}
          <Login />{" "}
        </AuthProvider>
      ),
    },
  ]);

  return routerApp;
}
