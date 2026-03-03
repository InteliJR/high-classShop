import { useMemo } from 'react';
import ImageGallery from 'react-image-gallery';
import 'react-image-gallery/styles/css/image-gallery.css';

interface ProductCarouselProps {
  imageUrls: string[];
}

export default function ProductCarousel({ imageUrls }: ProductCarouselProps) {
  const items = useMemo(
    () => {
      // Filtrar URLs vazias e criar items válidos
      const validUrls = imageUrls.filter(url => url && url.trim() !== '');
      
      if (validUrls.length === 0) {
        // Retornar placeholder se não houver imagens
        return [{
          original: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"%3E%3Crect fill="%23f0f0f0" width="400" height="300"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%23999" font-size="16"%3ESem imagem%3C/text%3E%3C/svg%3E',
          thumbnail: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"%3E%3Crect fill="%23f0f0f0" width="400" height="300"/%3E%3C/svg%3E',
          originalClass: 'w-full h-auto object-cover',
        }];
      }

      return validUrls.map((url) => ({
        original: url,
        thumbnail: url,
        originalClass: 'w-full h-auto object-contain',
      }));
    },
    [imageUrls]
  );

  return (
    <div className="w-full bg-gray-100 rounded-lg overflow-hidden">
      <style>{`
        .image-gallery-slide img {
          max-height: 500px;
          object-fit: contain;
        }
        .image-gallery-thumbnail {
          max-height: 80px;
        }
        .image-gallery-thumbnail img {
          object-fit: cover;
          width: 100%;
          height: 100%;
        }
      `}</style>
      <ImageGallery
        items={items}
        showPlayButton={false}
        showFullscreenButton
        showThumbnails={items.length > 1}
        slideDuration={350}
        additionalClass="rounded-lg overflow-hidden"
      />
    </div>
  );
}


