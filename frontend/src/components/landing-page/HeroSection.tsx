import { useNavigate } from 'react-router-dom';
import { motion, type Variants, easeOut } from 'framer-motion';
import aircraft1 from '../../assets/landing-page/aircraft_1.png';
import boat1 from '../../assets/landing-page/boat_1.png';
import car1 from '../../assets/landing-page/car_1.png';

export function HeroSection() {
  const navigate = useNavigate();

  // Variáveis de animação para o texto
  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.2,
      },
    },
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, x: -20 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.5, ease: easeOut } },
  };

  // Variantes das imagens (Apenas entrada suave, sem float)
  const imageVariants = (delay: number): Variants => ({
    hidden: { opacity: 0, y: 30, scale: 0.95 },
    visible: { 
      opacity: 1, 
      y: 0, 
      scale: 1,
      transition: { duration: 0.7, delay, ease: easeOut }
    }
  });

  return (
    <section className="relative px-6 sm:px-12 pt-16 pb-32 flex flex-col lg:flex-row items-center gap-16 max-w-[1400px] mx-auto overflow-visible">
      
      {/* Texto (Lado Esquerdo) */}
      <motion.div 
        className="lg:w-5/12 z-20 space-y-10"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.div variants={itemVariants}>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-4 text-white leading-tight tracking-tight">
            Exclusividade em <br />
            <span className="text-gray-300">Cada Detalhe</span>
          </h1>
          <p className="text-gray-300 text-base leading-relaxed max-w-md font-light">
            Bem-vindo à referência em intermediação de luxo. Conectamos você aos produtos mais desejados do mundo com segurança, discrição e agilidade.
          </p>
        </motion.div>

        <motion.div variants={itemVariants}>
          <h2 className="text-xl font-semibold mb-2 text-white flex items-center gap-3">
            <span className="w-6 h-[1px] bg-white/60 block"></span>
            Nossa Expertise
          </h2>
          <p className="text-gray-300 text-sm leading-relaxed max-w-lg font-light">
            Mais do que vender, nós entendemos o seu estilo de vida. Nossa curadoria rigorosa garante que cada aeronave, embarcação ou automóvel atenda aos mais altos padrões.
          </p>
        </motion.div>

        <motion.div variants={itemVariants}>
          <h2 className="text-xl font-semibold mb-2 text-white flex items-center gap-3">
            <span className="w-6 h-[1px] bg-white/60 block"></span>
            Categorias Premium
          </h2>
          <p className="text-gray-300 text-sm leading-relaxed max-w-lg font-light">
            Navegue por um portfólio selecionado. De supercarros esportivos a iates transatlânticos e jatos executivos prontos para decolar.
          </p>
        </motion.div>

        <motion.button 
          onClick={() => navigate('/login')}
          variants={itemVariants}
          whileHover={{ scale: 1.02, backgroundColor: "#f3f4f6" }}
          whileTap={{ scale: 0.98 }}
          className="bg-white text-black px-8 py-3 rounded text-base font-semibold hover:bg-gray-100 transition-all shadow-[0_4px_14px_0_rgba(255,255,255,0.2)] mt-4 tracking-wide"
        >
          Comece a Explorar
        </motion.button>
      </motion.div>

      {/* Mosaico de Imagens (Lado Direito) */}
      <div className="lg:w-7/12 relative h-[450px] lg:h-[600px] w-full mt-12 lg:mt-0 flex justify-center lg:block">
        
        {/* Barco (Fundo) - Z-INDEX 0 */}
        <motion.img 
          src={boat1} 
          alt="Luxury Boat" 
          variants={imageVariants(0.2)}
          initial="hidden"
          animate="visible"
          className="absolute top-0 right-0 lg:right-0 w-[280px] sm:w-[400px] lg:w-[480px] h-auto object-cover rounded-xl shadow-2xl z-0 opacity-90 transition-all duration-300" 
        />
        
        {/* Avião (Meio) - Z-INDEX 10 (Era 20) */}
        <motion.img 
          src={aircraft1} 
          alt="Private Jet" 
          variants={imageVariants(0.6)}
          initial="hidden"
          animate="visible"
          className="absolute bottom-0 lg:bottom-[50px] right-4 lg:right-[40px] w-[260px] sm:w-[350px] lg:w-[420px] h-auto object-cover rounded-xl shadow-2xl z-10 border-[3px] border-[#333333]" 
        />

        {/* Carro (Frente) - Z-INDEX 20 (Era 10) */}
        <motion.img 
          src={car1} 
          alt="Luxury Car" 
          variants={imageVariants(0.4)}
          initial="hidden"
          animate="visible"
          className="absolute top-[120px] lg:top-[140px] left-4 lg:left-8 w-[300px] sm:w-[420px] lg:w-[500px] h-auto object-cover rounded-xl shadow-2xl z-20 border-[3px] border-[#333333]" 
        />
        
      </div>
    </section>
  );
}