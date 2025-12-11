import { CookiesProvider } from "react-cookie";
import { AuthProvider } from "./contexts/AuthContext";
import MainLayout from "./layouts/MainLayout";
import DashboardPage from "./pages/admin/DashboardPage";

function App() {
  return (
    <>
      <CookiesProvider>
        <AuthProvider>
          <MainLayout>
            <DashboardPage />
          </MainLayout>
        </AuthProvider>
      </CookiesProvider>
    </>
  );
}

export default App;
