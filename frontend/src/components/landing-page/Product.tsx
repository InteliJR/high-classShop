import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

interface ProductProps {
  image: string;
  title: string;
  categoryLink: string;
  index?: number; // Para controlar o atraso da animação (stagger)
}

// Mapa de descrições baseado no título para substituir o Lorem Ipsum dinamicamente
const descriptions: Record<string, string> = {
  "Aeronave": "Viaje sem limites. Jatos executivos que combinam performance superior, conforto absoluto e privacidade total para seus voos.",
  "Barco": "Liberdade em alto mar. Iates e embarcações projetados com o mais alto rigor técnico para experiências náuticas inesquecíveis.",
  "Carro": "Engenharia e paixão. Uma seleção exclusiva de supercarros e veículos de luxo para quem não aceita menos que a excelência.",
  "Default": "Explore nossa coleção exclusiva de veículos de luxo selecionados rigorosamente para você."
};

export function Product({ image, title, categoryLink, index = 0 }: ProductProps) {
  const navigate = useNavigate();

  // Seleciona a descrição baseada no título ou usa a padrão
  const descriptionText = descriptions[title] || descriptions["Default"];

  return (
    <motion.div 
      onClick={() => navigate(categoryLink)}
      className="flex flex-col items-center text-center group cursor-pointer"
      
      // Animação de Entrada (Scroll)
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }} // Anima quando entra na tela (uma vez)
      transition={{ 
        duration: 0.6, 
        delay: index * 0.2, // Cria o efeito de "escadinha" entre os cards
        ease: "easeOut" 
      }}
      
      // Animação leve de Hover no container inteiro
      whileHover={{ y: -10 }}
    >
      <div className="w-full h-64 sm:h-80 overflow-hidden rounded-lg mb-6 shadow-lg bg-gray-200 relative">
        <motion.img 
          src={image} 
          alt={title} 
          // Mantendo a escala suave via CSS (Tailwind) pois funciona muito bem com imagens
          className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-110" 
        />
        {/* Overlay sutil ao passar o mouse */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-500" />
      </div>

      <h3 className="text-2xl font-bold text-gray-800 mb-3 group-hover:text-black transition-colors">
        {title}
      </h3>
      
      <p className="text-gray-500 text-sm max-w-xs px-4 leading-relaxed font-light group-hover:text-gray-700 transition-colors">
        {descriptionText}
      </p>
      
      {/* Indicador visual de clique animado */}
      <motion.div 
        className="mt-6 h-8 w-[1px] bg-gray-300 group-hover:bg-gray-800"
        transition={{ duration: 0.3 }}
      />
    </motion.div>
  );
}