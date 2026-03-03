import { useNavigate } from "react-router-dom";
import Logo from "../assets/logo_brokerage.png";
import { UserCircle2 } from "lucide-react";

// Componentes da Landing Page
import { HeroSection } from "../components/landing-page/HeroSection";
import { Product } from "../components/landing-page/Product";

// Imagens para os cards
import car2 from '../assets/landing-page/car_2.png';
import boat2 from '../assets/landing-page/boat_2.png';
import aircraft1 from '../assets/landing-page/aircraft_1.png'; // Reutilizando a imagem ou use uma aircraft_2 se tiver

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col font-sans">
      
      {/* SEÇÃO ESCURA (Header + Hero) */}
      <div className="bg-[#333333] w-full">
        {/* Header (Baseado no seu HomePage.tsx mas adaptado para o fundo escuro do design) */}
        <header className="w-full flex h-20 sm:h-24 justify-between items-center px-6 sm:px-12 max-w-7xl mx-auto">
          <img src={Logo} className="w-24 sm:w-32 h-auto" alt="High Class Shop Logo" />
          
          <nav className="hidden md:flex items-center gap-8 text-sm font-light uppercase tracking-widest text-gray-200">
            <a href="/catalog/aircrafts" className="hover:text-white transition-colors">Aeronave</a>
            <a href="/catalog/boats" className="hover:text-white transition-colors">Barco</a>
            <a href="/catalog/cars" className="hover:text-white transition-colors">Carro</a>
          </nav>

          <button 
            onClick={() => navigate("/login")}
            className="flex items-center gap-2 bg-white text-black px-5 py-2 rounded-md hover:bg-gray-200 transition-colors text-sm font-medium"
          >
            <UserCircle2 size={18} />
            <span className="hidden sm:inline">Login</span>
          </button>
        </header>

        {/* Hero Section Component */}
        <HeroSection />
      </div>

      {/* SEÇÃO CLARA (Produtos) */}
      <main className="flex-1 bg-[#E5E5E5] py-20 px-6 sm:px-12">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-12">
          <Product 
            title="Aeronave" 
            image={aircraft1} 
            categoryLink="/catalog/aircrafts"
          />
          <Product 
            title="Barco" 
            image={boat2} 
            categoryLink="/catalog/boats"
          />
          <Product 
            title="Carro" 
            image={car2} 
            categoryLink="/catalog/cars"
          />
        </div>
      </main>

      {/* Footer (Igual ao HomePage) */}
      <footer className="bg-[#E5E5E5] text-gray-500 py-8 px-6 text-center text-sm border-t border-gray-300">
        <p>&copy; 2024 High Class Shop. Todos os direitos reservados.</p>
      </footer>
    </div>
  );
}