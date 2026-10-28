export default function ProductImagePlaceholder({ failed = false, compact = false }: { failed?: boolean; compact?: boolean }) {
  return (
    <div
      role="img"
      aria-label={failed ? "Imagem indisponível" : "Sem fotos disponíveis"}
      className={`flex aspect-video max-h-[500px] w-full items-center justify-center overflow-hidden whitespace-normal bg-gray-100 px-2 text-gray-500 ${compact ? "text-[10px] leading-tight" : "text-sm"}`}
    >
      {failed ? compact ? "Indisponível" : "Imagem indisponível" : "Sem fotos disponíveis"}
    </div>
  );
}
