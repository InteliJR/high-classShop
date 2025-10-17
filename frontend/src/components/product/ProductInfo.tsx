// src/components/product/ProductInfo.tsx

// Importamos a peça menor que vamos usar
import InfoTag from './InfoTag';

// Definimos o formato dos dados que este componente espera receber
interface CarData {
  model: string;
  year: number;
  status: string;
  description:string;
  imageUrls: string[];
}

interface ProductInfoProps {
  car: CarData;
}

const ProductInfo = ({ car }: ProductInfoProps) => {
  return (
    <div className="flex flex-col gap-6">
      {/* Tags de Informação */}
      <div className="flex flex-wrap gap-3">
        <InfoTag label="Modelo" value={car.model} />
        <InfoTag label="Ano" value={car.year} />
        <InfoTag label="Estado" value={car.status} />
      </div>

      {/* Carrossel de Imagem (simplificado) */}
      <div>
        <img 
          src={car.imageUrls[0]} 
          alt={`Imagem do ${car.model}`}
          className="w-full h-auto object-cover rounded-lg shadow-lg"
        />
        {/* As bolinhas de navegação do carrossel iriam aqui */}
      </div>

      {/* Descrição */}
      <div>
        <h3 className="text-xl font-semibold mb-2">Descrição</h3>
        <p className="text-gray-600 leading-relaxed">
          {car.description}
        </p>
      </div>
    </div>
  );
};

export default ProductInfo;