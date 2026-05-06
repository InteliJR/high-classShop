import { useNavigate } from "react-router-dom";
import Logo from "../assets/logo_brokerage.png";
import { UserCircle2 } from "lucide-react";

export default function HomePage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-primary flex flex-col">
      {/* Header */}
      <header className="w-full flex h-20 sm:h-24 bg-background-secondary text-white justify-between items-center px-6 sm:px-12">
        <img src={Logo} className="w-24 sm:w-32 h-auto" alt="High Class Shop Logo" />
        <nav className="hidden md:flex items-center gap-8">
          <a href="#about" className="hover:text-gray-300 transition-colors">Sobre nós</a>
          <a href="/catalog/aircrafts" className="hover:text-gray-300 transition-colors">Aeronaves</a>
          <a href="/catalog/boats" className="hover:text-gray-300 transition-colors">Embarcações</a>
          <a href="/catalog/cars" className="hover:text-gray-300 transition-colors">Carros</a>
        </nav>
        <button 
          onClick={() => navigate("/login")}
          className="flex items-center gap-2 bg-white text-black px-4 py-2 rounded-md hover:bg-gray-200 transition-colors"
        >
          <UserCircle2 size={20} />
          <span className="hidden sm:inline">Login</span>
        </button>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 sm:px-12 py-12 text-white text-center">
        <div className="max-w-4xl mx-auto space-y-8">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold leading-tight">
            Seu próximo produto de luxo está aqui
          </h1>
          <p className="text-lg sm:text-xl md:text-2xl text-gray-300 max-w-2xl mx-auto">
            Explore nossa coleção exclusiva de carros, embarcações e aeronaves.
            Encontre o produto perfeito para você ou agende uma consultoria especializada.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-8">
            <button
              onClick={() => navigate("/catalog/cars")}
              className="px-8 py-4 bg-white text-black text-lg font-semibold rounded-lg hover:bg-gray-200 transition-all transform hover:scale-105"
            >
              Explorar Catálogo
            </button>
            <button
              onClick={() => navigate("/login")}
              className="px-8 py-4 bg-transparent border-2 border-white text-white text-lg font-semibold rounded-lg hover:bg-white hover:text-black transition-all transform hover:scale-105"
            >
              Fazer Login
            </button>
          </div>
        </div>

        {/* Categories Preview */}
        <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-8 max-w-5xl mx-auto w-full">
          <div 
            onClick={() => navigate("/catalog/cars")}
            className="bg-background-secondary/50 p-6 rounded-xl cursor-pointer hover:bg-background-secondary transition-all transform hover:scale-105 group"
          >
            <div className="text-4xl mb-4">🚗</div>
            <h3 className="text-xl font-semibold mb-2">Carros</h3>
            <p className="text-gray-400 text-sm">Explore nossa seleção de carros de luxo</p>
          </div>
          
          <div 
            onClick={() => navigate("/catalog/boats")}
            className="bg-background-secondary/50 p-6 rounded-xl cursor-pointer hover:bg-background-secondary transition-all transform hover:scale-105 group"
          >
            <div className="text-4xl mb-4">🚤</div>
            <h3 className="text-xl font-semibold mb-2">Embarcações</h3>
            <p className="text-gray-400 text-sm">Descubra iates e embarcações exclusivas</p>
          </div>
          
          <div 
            onClick={() => navigate("/catalog/aircrafts")}
            className="bg-background-secondary/50 p-6 rounded-xl cursor-pointer hover:bg-background-secondary transition-all transform hover:scale-105 group"
          >
            <div className="text-4xl mb-4">✈️</div>
            <h3 className="text-xl font-semibold mb-2">Aeronaves</h3>
            <p className="text-gray-400 text-sm">Conheça aeronaves executivas premium</p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-background-secondary text-gray-400 py-6 px-6 text-center">
        <p>&copy; 2024 High Class Shop. Todos os direitos reservados.</p>
      </footer>
    </div>
  );
}

