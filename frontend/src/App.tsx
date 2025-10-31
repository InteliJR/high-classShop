import { AuthProvider } from "./contexts/AuthContext";
import MainLayout from "./layouts/MainLayout";
import CompaniesPage from "./pages/admin/CompaniesPage";

function App() {
  return (
    <>
      <AuthProvider>
        <MainLayout>
          <CompaniesPage />
        </MainLayout>
      </AuthProvider>
    </>
  );
}

export default App;
