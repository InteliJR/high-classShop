import React, { useState, useRef } from "react";
import { ZoomIn, ZoomOut } from "lucide-react";

export interface ImageData {
  data: string; // base64 ou URL do S3
  is_primary: boolean;
  preview?: string; // URL para preview
  id?: number; // ID da imagem existente (se for edição)
  isExisting?: boolean; // Flag para indicar se é uma imagem já existente no S3
}

interface ImageUploaderProps {
  images: ImageData[];
  onChange: (images: ImageData[]) => void;
  maxImages?: number;
  maxSizeMB?: number;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({
  images,
  onChange,
  maxImages = 10,
  maxSizeMB = 5,
}) => {
  const [error, setError] = useState<string | null>(null);
  const [cropModal, setCropModal] = useState(false);
  const [cropImageIndex, setCropImageIndex] = useState<number | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  /**
   * Converte um arquivo File para base64 string.
   */
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);

    if (!e.target.files || e.target.files.length === 0) return;

    const files = Array.from(e.target.files);

    // Validar número máximo de imagens
    if (images.length + files.length > maxImages) {
      setError(`Você pode adicionar no máximo ${maxImages} imagens.`);
      return;
    }

    // Validar tamanho de cada arquivo
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    for (const file of files) {
      if (file.size > maxSizeBytes) {
        setError(
          `A imagem "${file.name}" ultrapassa o limite de ${maxSizeMB} MB.`,
        );
        return;
      }
    }

    try {
      const newImages: ImageData[] = [];

      for (const file of files) {
        const base64 = await fileToBase64(file);
        newImages.push({
          data: base64,
          is_primary: images.length === 0 && newImages.length === 0, // Primeira imagem é principal
          preview: base64,
        });
      }

      onChange([...images, ...newImages]);
    } catch (err) {
      setError("Erro ao processar imagens. Tente novamente.");
      console.error("Erro ao converter imagens:", err);
    }
  };

  const handleRemoveImage = (index: number) => {
    const newImages = images.filter((_, i) => i !== index);

    // Se removeu a imagem principal e ainda há imagens, tornar a primeira como principal
    if (images[index].is_primary && newImages.length > 0) {
      newImages[0].is_primary = true;
    }

    onChange(newImages);
  };

  const handleSetPrimary = (index: number) => {
    const newImages = images.map((img, i) => ({
      ...img,
      is_primary: i === index,
    }));
    onChange(newImages);
  };

  const openCropModal = (index: number) => {
    setCropImageIndex(index);
    setZoomLevel(1);
    setOffsetX(0);
    setOffsetY(0);
    setCropModal(true);
  };

  const closeCropModal = () => {
    setCropModal(false);
    setCropImageIndex(null);
  };

  const applyCrop = () => {
    if (cropImageIndex === null || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      canvas.width = 400;
      canvas.height = 300;

      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const scaledWidth = img.width * zoomLevel;
      const scaledHeight = img.height * zoomLevel;

      ctx.drawImage(img, offsetX, offsetY, scaledWidth, scaledHeight);

      const croppedBase64 = canvas.toDataURL("image/jpeg", 0.9);

      const newImages = [...images];
      newImages[cropImageIndex] = {
        ...newImages[cropImageIndex],
        data: croppedBase64,
        preview: croppedBase64,
      };
      onChange(newImages);
      closeCropModal();
    };
    img.src = images[cropImageIndex].preview || images[cropImageIndex].data;
  };

  return (
    <div className="space-y-4">
      <div>
        <label
          htmlFor="images"
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          Imagens do Produto *
        </label>
        <input
          id="images"
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileSelect}
          className="block w-full text-sm text-gray-500
            file:mr-4 file:py-2 file:px-4
            file:rounded-md file:border-0
            file:text-sm file:font-semibold
            file:bg-blue-50 file:text-blue-700
            hover:file:bg-blue-100
            cursor-pointer"
        />
        <p className="mt-1 text-xs text-gray-500">
          Máximo de {maxImages} imagens. Tamanho máximo: {maxSizeMB} MB por
          imagem. Dica: Clique em "Ajustar" para recortar imagens mal
          proporcionadas.
        </p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {images.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {images.map((image, index) => (
            <div
              key={index}
              className={`relative border-2 rounded-lg overflow-hidden ${
                image.is_primary ? "border-blue-500" : "border-gray-200"
              }`}
            >
              <img
                src={image.preview || image.data}
                alt={`Preview ${index + 1}`}
                className="w-full h-32 object-contain bg-gray-100"
              />
              <div className="absolute top-1 right-1 flex gap-1">
                <button
                  type="button"
                  onClick={() => handleRemoveImage(index)}
                  className="bg-red-500 text-white p-1 rounded-full hover:bg-red-600"
                  title="Remover"
                >
                  ✕
                </button>
              </div>
              <div className="p-2 bg-white space-y-1">
                <button
                  type="button"
                  onClick={() => openCropModal(index)}
                  className="text-xs w-full py-1 px-2 rounded bg-yellow-100 text-yellow-800 hover:bg-yellow-200"
                  title="Ajustar imagem"
                >
                  🔍 Ajustar
                </button>
                <button
                  type="button"
                  onClick={() => handleSetPrimary(index)}
                  className={`text-xs w-full py-1 px-2 rounded ${
                    image.is_primary
                      ? "bg-blue-500 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {image.is_primary ? "✓ Principal" : "Marcar como principal"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de Crop */}
      {cropModal && cropImageIndex !== null && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6 space-y-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">Ajustar Imagem</h3>
              <button
                type="button"
                onClick={closeCropModal}
                className="text-2xl hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div
              className="bg-gray-100 rounded-lg p-4 flex justify-center items-center"
              style={{ height: "300px" }}
            >
              <img
                src={
                  images[cropImageIndex].preview || images[cropImageIndex].data
                }
                alt="Crop preview"
                style={{
                  maxWidth: "100%",
                  maxHeight: "100%",
                  objectFit: "contain",
                  transform: `scale(${zoomLevel}) translate(${offsetX}px, ${offsetY}px)`,
                  transition: "transform 0.2s",
                }}
              />
            </div>

            <div className="space-y-3">
              <div className="flex gap-2 items-center">
                <label className="text-sm font-medium w-20">Zoom:</label>
                <button
                  type="button"
                  onClick={() => setZoomLevel(Math.max(0.5, zoomLevel - 0.2))}
                  className="p-2 bg-gray-200 rounded hover:bg-gray-300"
                >
                  <ZoomOut size={18} />
                </button>
                <input
                  type="range"
                  min="0.5"
                  max="3"
                  step="0.1"
                  value={zoomLevel}
                  onChange={(e) => setZoomLevel(parseFloat(e.target.value))}
                  className="flex-1"
                />
                <button
                  type="button"
                  onClick={() => setZoomLevel(Math.min(3, zoomLevel + 0.2))}
                  className="p-2 bg-gray-200 rounded hover:bg-gray-300"
                >
                  <ZoomIn size={18} />
                </button>
              </div>

              <div className="bg-blue-50 p-3 rounded text-sm text-blue-800">
                💡 Use o zoom para enquadrar a imagem. A imagem será cortada em
                proporção 4:3 (400x300px).
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-4 border-t">
              <button
                type="button"
                onClick={closeCropModal}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={applyCrop}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Aplicar Ajuste
              </button>
            </div>

            <canvas ref={canvasRef} style={{ display: "none" }} />
          </div>
        </div>
      )}
    </div>
  );
};
