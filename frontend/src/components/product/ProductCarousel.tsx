import { useMemo } from 'react';
import ImageGallery from 'react-image-gallery';
import 'react-image-gallery/styles/css/image-gallery.css';

interface ProductCarouselProps {
  imageUrls: string[];
}

export default function ProductCarousel({ imageUrls }: ProductCarouselProps) {
  const items = useMemo(
    () =>
      imageUrls.map((url) => ({
        original: url,
        thumbnail: url,
        originalClass: 'h-64 object-cover',
      })),
    [imageUrls]
  );

  return (
    <div className="w-full">
      <ImageGallery
        items={items}
        showPlayButton={false}
        showFullscreenButton
        showThumbnails
        slideDuration={350}
        additionalClass="rounded-lg overflow-hidden"
      />
    </div>
  );
}


