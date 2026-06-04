import { CookiesProvider } from "react-cookie";
import { AuthProvider } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeProvider";
import MainLayout from "./layouts/MainLayout";
import DashboardPage from "./pages/admin/DashboardPage";

function App() {
  return (
    <>
      <CookiesProvider>
        <ThemeProvider>
          <AuthProvider>
            <MainLayout>
              <DashboardPage />
            </MainLayout>
          </AuthProvider>
        </ThemeProvider>
      </CookiesProvider>
    </>
  );
}

export default App;
