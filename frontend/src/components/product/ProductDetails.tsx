// import { useState } from 'react';
// import { ChevronLeft, ChevronRight, X } from 'lucide-react';

interface ProductDetailsProps {
  model: string;
  year: number;
  status: string;
  description: string;
  imageUrls: string[];
}

export default function ProductDetails({
    model,
    year,
    status,
    description,
    // imageUrls,
  }: ProductDetailsProps) {
    
  return (
    <div className="max-w-md mx-auto bg-color-bg-container rounded-lg shadow overflow-hidden">

      {/* <!-- Conteúdo do card --> */}
      <div className="p-4">
        {/* <!-- Modelo, Ano, Estado --> */}
        <div className="flex flex-wrap text-xs text-gray-600 mb-2">
          <span className="mr-4"><strong>Modelo:</strong> {model}</span>
          <span className="mr-4"><strong>Ano:</strong> {year}</span>
          <span><strong>Estado:</strong> {status}</span>
        </div>

        {/* <!-- Imagem do carro --> */}
        {/* <img
          src="https://via.placeholder.com" 
          alt="Toyota Corolla" 
          className="w-full h-64 object-cover"
        /> */}

        {/* <ProductCarousel imageUrls={imageUrls} /> */}

        {/* <!-- Descrição --> */}
        <div className="text-gray-700 text-xs mb-4 text-wrap">
          <h3 className="text-sm font-semibold mb-2">Descrição</h3>
          <p className="text-xs text-gray-700">{description}</p>
        </div>

      </div>
    </div>
  );
}