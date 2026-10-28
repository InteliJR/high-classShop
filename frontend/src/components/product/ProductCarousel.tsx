import ImageGallery from "react-image-gallery";
import "react-image-gallery/styles/css/image-gallery.css";
import { useProductImages } from "../../hooks/useProductImages";
import ProductImagePlaceholder from "./ProductImagePlaceholder";

interface ProductCarouselProps {
  imageUrls: string[];
  showImageErrors?: boolean;
}

export default function ProductCarousel({ imageUrls, showImageErrors = false }: ProductCarouselProps) {
  const { imageUrls: visibleUrls, failedUrls, markFailed } = useProductImages(imageUrls, showImageErrors);
  const items = visibleUrls.map((url, index) => ({
    original: url,
    thumbnail: url,
    originalAlt: `Foto ${index + 1} do produto`,
    thumbnailAlt: `Miniatura da foto ${index + 1}`,
  }));

  return (
    <div className="product-gallery w-full bg-gray-100 rounded-lg overflow-hidden">
      <style>{`
        .product-gallery .image-gallery-slide img {
          max-height: 500px;
          object-fit: contain;
        }
        .product-gallery .image-gallery-thumbnail {
          max-height: 80px;
        }
        .product-gallery .image-gallery-thumbnail img {
          object-fit: cover;
          width: 100%;
          height: 100%;
        }
      `}</style>
      {items.length ? (
        <ImageGallery
          items={items}
          showPlayButton={false}
          showFullscreenButton
          showThumbnails={items.length > 1}
          slideDuration={350}
          additionalClass="rounded-lg overflow-hidden"
          renderItem={(item) => failedUrls.has(item.original) ? (
            <ProductImagePlaceholder failed />
          ) : (
            <img
              className="image-gallery-image"
              src={item.original}
              alt={item.originalAlt}
              onError={() => markFailed(item.original)}
            />
          )}
          renderThumbInner={(item) => failedUrls.has(item.original) ? (
            <ProductImagePlaceholder failed compact />
          ) : (
            <img
              className="image-gallery-thumbnail-image"
              src={item.thumbnail}
              alt={item.thumbnailAlt}
              onError={() => markFailed(item.original)}
            />
          )}
        />
      ) : <ProductImagePlaceholder />}
    </div>
  );
}
