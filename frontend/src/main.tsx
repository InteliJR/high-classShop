import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import MainLayout from './layouts/MainLayout.tsx'
import Catalog from './pages/catalog.tsx'

const router = createBrowserRouter([
  {path:"/", element: <App/>},
  {path: "/catalog/:category", element: <MainLayout> <Catalog /> </MainLayout>},
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router = {router} />
  </StrictMode>,
)
