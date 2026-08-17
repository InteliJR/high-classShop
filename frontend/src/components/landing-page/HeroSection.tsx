import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useReducedMotion, type Variants, easeOut } from 'framer-motion';
import ProductTypePreferenceModal, {
  type PreferredProductType,
} from '../product/ProductTypePreferenceModal';

const HERO_POSTER = '/hero/hero-poster.webp';

const catalogRouteMap: Record<PreferredProductType, string> = {
  CAR: '/catalog/cars',
  BOAT: '/catalog/boats',
  AIRCRAFT: '/catalog/aircrafts',
};

type NetworkInformation = { saveData?: boolean; effectiveType?: string };

/**
 * Fundo em vídeo do bloco escuro (header + hero).
 * Fica atrás do header de propósito: o scrim é sólido só do lado esquerdo, e
 * um header opaco sobre a metade transparente do vídeo lê como erro de corte.
 */
export function HeroBackdrop() {
  const reduceMotion = useReducedMotion();
  const [showVideo, setShowVideo] = useState(false);

  useEffect(() => {
    // Com reduced-motion o vídeo nem é montado — só o poster estático.
    if (reduceMotion) return;
    const conn = (navigator as Navigator & { connection?: NetworkInformation }).connection;
    const lite = Boolean(conn?.saveData) || /(^|-)2g$/.test(conn?.effectiveType ?? '');
    if (lite) return;
    setShowVideo(true);
  }, [reduceMotion]);

  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
      {showVideo ? (
        <video
          className="hero-video"
          poster={HERO_POSTER}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          tabIndex={-1}
        >
          {/* AV1 primeiro: 6,2 MB contra 9,4 do H.264, e com SSIM maior.
              Safari antigo e iPhone anterior ao 15 Pro caem no mp4. */}
          <source src="/hero/hero.av1.mp4" type='video/mp4; codecs="av01.0.08M.08"' />
          <source src="/hero/hero.mp4" type="video/mp4" />
        </video>
      ) : (
        <img className="hero-video" src={HERO_POSTER} alt="" fetchPriority="high" />
      )}

      <div className="hero-scrim" />
    </div>
  );
}

export function HeroSection() {
  const navigate = useNavigate();
  const [isProductTypeModalOpen, setIsProductTypeModalOpen] = useState(false);

  const handleSelectProductType = (type: PreferredProductType) => {
    setIsProductTypeModalOpen(false);
    navigate(catalogRouteMap[type]);
  };

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

  return (
    // min-h fixo: o mosaico de imagens sustentava a altura do hero; sem ele o
    // bloco colapsaria e o vídeo entraria depois do poster gerando CLS.
    <section className="relative px-6 sm:px-12 pt-12 pb-24 lg:pt-20 lg:pb-32 max-w-[1400px] mx-auto min-h-[560px] lg:min-h-[620px] flex items-center">
      <motion.div
        className="lg:w-5/12 space-y-10"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.div variants={itemVariants}>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-4 text-white leading-tight tracking-tight">
            Exclusividade em <br />
            <span className="text-gray-300">Cada Detalhe</span>
          </h1>
          {/* gray-300 sobre vídeo exige 0,80 de scrim contra 0,67 do quase-branco;
              é ele que travava a rampa de esvair mais cedo. */}
          <p className="text-gray-100 text-base leading-relaxed max-w-md font-light">
            Bem-vindo à referência em intermediação de luxo. Conectamos você aos produtos mais desejados do mundo com segurança, discrição e agilidade.
          </p>
        </motion.div>

        <motion.div variants={itemVariants}>
          <h2 className="text-xl font-semibold mb-2 text-white flex items-center gap-3">
            <span className="w-6 h-[1px] bg-white/60 block"></span>
            Nossa Expertise
          </h2>
          <p className="text-gray-100 text-sm leading-relaxed max-w-md font-light">
            Mais do que vender, nós entendemos o seu estilo de vida. Nossa curadoria rigorosa garante que cada aeronave, embarcação ou automóvel atenda aos mais altos padrões.
          </p>
        </motion.div>

        <motion.div variants={itemVariants}>
          <h2 className="text-xl font-semibold mb-2 text-white flex items-center gap-3">
            <span className="w-6 h-[1px] bg-white/60 block"></span>
            Categorias Premium
          </h2>
          <p className="text-gray-100 text-sm leading-relaxed max-w-md font-light">
            Navegue por um portfólio selecionado. De supercarros e embarcações premium a aeronaves executivas, encontre ativos que combinam exclusividade, performance e sofisticação.
          </p>
        </motion.div>

        <motion.button
          onClick={() => setIsProductTypeModalOpen(true)}
          variants={itemVariants}
          whileHover={{ scale: 1.02, backgroundColor: '#f3f4f6' }}
          whileTap={{ scale: 0.98 }}
          className="bg-white text-black px-8 py-3 rounded text-base font-semibold hover:bg-gray-100 transition-all shadow-[0_4px_14px_0_rgba(255,255,255,0.2)] mt-4 tracking-wide"
        >
          Comece a Explorar
        </motion.button>
      </motion.div>

      <ProductTypePreferenceModal
        isOpen={isProductTypeModalOpen}
        title="O que você quer explorar?"
        description="Escolha uma categoria para ver o catálogo correspondente."
        onClose={() => setIsProductTypeModalOpen(false)}
        onSelect={handleSelectProductType}
      />
    </section>
  );
}
