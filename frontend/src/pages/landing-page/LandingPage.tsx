import { useNavigate } from "react-router-dom";
import Logo from "../../assets/logo_brokerage.png";
import { UserCircle2 } from "lucide-react";

// Componentes da Landing Page
import { HeroBackdrop, HeroSection } from "../../components/landing-page/HeroSection";

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col font-sans">
      
      {/* SEÇÃO ESCURA (Header + Hero) — vídeo de fundo + scrim atrás dos dois */}
      <div className="bg-[#333333] w-full relative isolate overflow-hidden">
        <HeroBackdrop />

        {/* Header (Baseado no seu HomePage.tsx mas adaptado para o fundo escuro do design) */}
        <header className="relative z-10 w-full flex h-20 sm:h-24 justify-between items-center px-6 sm:px-12 max-w-7xl mx-auto">
          <img src={Logo} className="w-24 sm:w-32 h-auto" alt="High Class Shop Logo" />
          
          <nav className="hidden md:flex items-center gap-8 text-sm font-light uppercase tracking-widest text-gray-200">
            <a href="/catalog/aircrafts" className="hover:text-white transition-colors">Aeronaves</a>
            <a href="/catalog/boats" className="hover:text-white transition-colors">Embarcações</a>
            <a href="/catalog/cars" className="hover:text-white transition-colors">Carros</a>
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
        <div className="relative z-10">
          <HeroSection />
        </div>
      </div>

      {/* Footer — gradiente a partir do cinza da seção escura acima, sem corte brusco de cor */}
      <footer className="bg-gradient-to-b from-[#333333] to-[#1f1f1f] text-gray-400 py-8 px-6 text-center text-sm border-t border-white/10">
        <p>&copy; 2024 High Class Shop. Todos os direitos reservados.</p>
      </footer>
    </div>
  );
}