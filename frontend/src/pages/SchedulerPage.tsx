// src/pages/SchedulerPage.tsx

import ProductInfo from '../components/product/ProductInfo';
import BookingCalendar from '../components/booking/BookingCalendar';

const SchedulerPage = () => {
  // 1. Dados mocados. No mundo real, isso viria de uma chamada de API.
  const carData = {
    model: 'Toyota Corolla',
    year: 2023,
    status: 'Usado',
    description: 'Lorem ipsum dolor sit amet. Quo nesciunt accusamus qui enim repellat quo iure Lorem ipsum dolor sit amet.',
    imageUrls: ['/path/to/your/car-image.png'], // Use o caminho da imagem do seu projeto
  };

  const handleSchedule = (selectedDate: Date) => {
    // Lógica para quando o usuário clicar em "Agendar"
    console.log('Agendamento solicitado para a data:', selectedDate);
    alert(`Agendamento para ${selectedDate.toLocaleDateString()} solicitado!`);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Breadcrumb (poderia ser outro componente) */}
      <h1 className="text-3xl font-light mb-8">
        Carros <span className="text-gray-400">| {carData.model}</span>
      </h1>

      {/* 2. Organizando os "blocos grandes" com CSS Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Bloco da Esquerda: Passamos todos os dados do carro via props */}
        <ProductInfo car={carData} />

        {/* Bloco da Direita: Passamos a função de agendar via props */}
        <BookingCalendar onSchedule={handleSchedule} />
      </div>
    </div>
  );
};

export default SchedulerPage;