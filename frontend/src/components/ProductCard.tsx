import { useState } from "react";
import type { Product } from "../types/types";

function formatValue(valor: number) {
  return valor.toLocaleString("pt-br", { style: "currency", currency: "BRL" });
}

export default function ProductCard({
  imageUrl,
  marca,
  modelo,
  descricao,
  valor,
}: Product) {
  const [rotateX, setRotateX] = useState(0);
  const [rotateY, setRotateY] = useState(0);

  const handleMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    const rotateXValue = ((y - centerY) / centerY) * -10;
    const rotateYValue = ((x - centerX) / centerX) * 10;
    
    setRotateX(rotateXValue);
    setRotateY(rotateYValue);
  };

  const handleMouseLeave = () => {
    setRotateX(0);
    setRotateY(0);
  };

  return (
    <article 
      className="h-full w-full rounded-lg border border-black px-3 sm:px-6 pt-3 sm:pt-6 pb-4 flex flex-col gap-2 hover:shadow-xl transition-all duration-300 ease-out cursor-pointer"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        transform: `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(${rotateX || rotateY ? 1.05 : 1})`,
        transition: 'transform 0.1s ease-out, box-shadow 0.3s ease-out',
      }}
    >
      <div className="flex justify-center">
        {imageUrl && (
          <div className="w-full max-w-md aspect-square sm:aspect-video overflow-hidden rounded-lg">
            {" "}
            <img
              src={imageUrl}
              alt={`Imagem do produto ${marca} ${modelo}`}
              className="w-full h-full object-cover"
            />{" "}
          </div>
        )}
      </div>

      <div className="flex flex-col text-sm sm:text-xl gap-2 justify-between items-center h-full">
        <div className="flex flex-col h-full justify-center align-center">
        <h2 className="font-semibold">
          {marca} {modelo}
        </h2>
        </div>
        <div className="flex flex-col gap-y-1">
        <p className="text-[8px] sm:text-xs line-clamp-2">{descricao}</p>
        <p className="">{formatValue(valor)}</p>
        </div>
      </div>
    </article>
  );
}
