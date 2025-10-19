// src/components/product/ProductDetails.tsx
import { useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

// ✅ CORRIGIDO: Interface com nome correto
interface ProductDetailsProps {
  model: string;
  year: number;
  status: string;
  description: string;
  imageUrls: string[];
}

// ✅ CORRIGIDO: Exporta com nome correto
export default function ProductDetails({
  model,
  year,
  status,
  description,
  imageUrls,
}: ProductDetailsProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [lightboxImageIndex, setLightboxImageIndex] = useState(0);

  // Navegação do carrossel
  const nextImage = () => {
    setCurrentImageIndex((prev) => 
      prev === imageUrls.length - 1 ? 0 : prev + 1
    );
  };

  const previousImage = () => {
    setCurrentImageIndex((prev) => 
      prev === 0 ? imageUrls.length - 1 : prev - 1
    );
  };

  const goToImage = (index: number) => {
    setCurrentImageIndex(index);
  };

  // ✅ NOVO: Funções do lightbox
  const openLightbox = (index: number) => {
    setLightboxImageIndex(index);
    setIsLightboxOpen(true);
  };

  const closeLightbox = () => {
    setIsLightboxOpen(false);
  };

  const nextLightboxImage = () => {
    setLightboxImageIndex((prev) => 
      prev === imageUrls.length - 1 ? 0 : prev + 1
    );
  };

  const previousLightboxImage = () => {
    setLightboxImageIndex((prev) => 
      prev === 0 ? imageUrls.length - 1 : prev - 1
    );
  };

  return (
    <>
      <div className="bg-white rounded-lg overflow-hidden shadow-sm">
        {/* Informações principais */}
        <div className="p-6 space-y-2">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
            <span>
              <span className="font-medium text-gray-700">Modelo:</span> {model}
            </span>
            <span>
              <span className="font-medium text-gray-700">Ano:</span> {year}
            </span>
            <span>
              <span className="font-medium text-gray-700">Estado:</span> {status}
            </span>
          </div>
        </div>

        {/* Carrossel de imagens */}
        <div className="relative bg-gray-100 aspect-[4/3] group">
          {/* ✅ NOVO: Imagem clicável */}
          <img
            src={imageUrls[currentImageIndex]}
            alt={`${model} - Imagem ${currentImageIndex + 1}`}
            className="w-full h-full object-cover cursor-pointer"
            onClick={() => openLightbox(currentImageIndex)}
          />

          {/* ✅ NOVO: Overlay ao passar o mouse */}
          <div 
            className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors cursor-pointer flex items-center justify-center"
            onClick={() => openLightbox(currentImageIndex)}
          >
            <span className="text-white opacity-0 group-hover:opacity-100 transition-opacity text-sm font-medium bg-black/50 px-4 py-2 rounded-lg">
              Clique para ampliar
            </span>
          </div>

          {/* Botões de navegação (só aparecem se houver múltiplas imagens) */}
          {imageUrls.length > 1 && (
            <>
              <button
                onClick={previousImage}
                className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white p-2 rounded-full shadow-lg transition-all opacity-0 group-hover:opacity-100"
                aria-label="Imagem anterior"
              >
                <ChevronLeft className="w-6 h-6 text-gray-700" />
              </button>

              <button
                onClick={nextImage}
                className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white p-2 rounded-full shadow-lg transition-all opacity-0 group-hover:opacity-100"
                aria-label="Próxima imagem"
              >
                <ChevronRight className="w-6 h-6 text-gray-700" />
              </button>

              {/* Indicadores de paginação */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                {imageUrls.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => goToImage(index)}
                    className={`h-2 rounded-full transition-all ${
                      index === currentImageIndex
                        ? 'bg-white w-6'
                        : 'bg-white/60 hover:bg-white/80 w-2'
                    }`}
                    aria-label={`Ir para imagem ${index + 1}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Descrição */}
        <div className="p-6">
          <h3 className="font-semibold text-gray-900 mb-2">Descrição</h3>
          <p className="text-gray-600 text-sm leading-relaxed">
            {description}
          </p>
        </div>
      </div>

      {/* ✅ NOVO: MODAL LIGHTBOX - TELA CHEIA */}
      {isLightboxOpen && (
        <div 
          className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center"
          onClick={closeLightbox}
        >
          {/* Botão fechar */}
          <button
            onClick={closeLightbox}
            className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors z-10"
            aria-label="Fechar"
          >
            <X className="w-8 h-8" />
          </button>

          {/* Contador de imagens */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 text-white text-sm bg-black/50 px-4 py-2 rounded-full">
            {lightboxImageIndex + 1} / {imageUrls.length}
          </div>

          {/* Imagem em tela cheia */}
          <div 
            className="relative max-w-7xl max-h-[90vh] w-full h-full flex items-center justify-center px-4"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={imageUrls[lightboxImageIndex]}
              alt={`${model} - Imagem ${lightboxImageIndex + 1}`}
              className="max-w-full max-h-full object-contain"
            />

            {/* Navegação do lightbox */}
            {imageUrls.length > 1 && (
              <>
                <button
                  onClick={previousLightboxImage}
                  className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/30 backdrop-blur-sm p-3 rounded-full transition-colors"
                  aria-label="Imagem anterior"
                >
                  <ChevronLeft className="w-8 h-8 text-white" />
                </button>

                <button
                  onClick={nextLightboxImage}
                  className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/30 backdrop-blur-sm p-3 rounded-full transition-colors"
                  aria-label="Próxima imagem"
                >
                  <ChevronRight className="w-8 h-8 text-white" />
                </button>
              </>
            )}
          </div>

          {/* Miniaturas */}
          {imageUrls.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 max-w-md overflow-x-auto px-4">
              {imageUrls.map((url, index) => (
                <button
                  key={index}
                  onClick={(e) => {
                    e.stopPropagation();
                    setLightboxImageIndex(index);
                  }}
                  className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                    index === lightboxImageIndex
                      ? 'border-white scale-110'
                      : 'border-white/30 hover:border-white/60'
                  }`}
                >
                  <img
                    src={url}
                    alt={`Miniatura ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}