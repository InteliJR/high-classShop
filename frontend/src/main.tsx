import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { RouterProvider } from "react-router-dom";
import { CookiesProvider } from "react-cookie";
import { AuthProvider } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeProvider";

import RouterApp from "./routes/routes.tsx";

const router = RouterApp();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <CookiesProvider>
      <ThemeProvider>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </ThemeProvider>
    </CookiesProvider>
  </StrictMode>
);
