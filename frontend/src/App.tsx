import { BrowserRouter, Routes, Route } from "react-router-dom";

import MainLayout from "./layouts/MainLayout";

import CompaniesPage from "./pages/admin/CompaniesPage";
import SchedulerPage from "./pages/SchedulerPage";
// import ProductListPage from "./pages/ProductListPage"; // Página de listagem


function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <MainLayout>
              <CompaniesPage />
            </MainLayout>
          }
        />
        <Route
          path="/companies"
          element={
            <MainLayout>
              <CompaniesPage />
            </MainLayout>
          }
        />
        <Route
          path="/:categoria/:id"
          element={
            <MainLayout>
              <SchedulerPage />
            </MainLayout>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;