import { CookiesProvider } from "react-cookie";
import { AuthProvider } from "./contexts/AuthContext";
import MainLayout from "./layouts/MainLayout";
import CompaniesPage from "./pages/admin/CompaniesPage";

function App() {
  return (
    <>
      <CookiesProvider>
        <AuthProvider>
          <MainLayout>
            <CompaniesPage />
          </MainLayout>
        </AuthProvider>
      </CookiesProvider>
    </>
  );
}

export default App;
