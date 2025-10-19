import ProductDetails from '../components/product/ProductDetails';
import Breadcrumb from '../components/ui/Breadcrumb';

//  import { useParams } from 'react-router-dom';
//  import { useEffect, useState } from 'react';
//  import ProductCard from '../components/product/ProductCard';
//  import BookingCalendar from '../components/booking/BookingCalendar';


const SchedulerPage = () => {
  // const { id } = useParams<{ id: string }>();
  // adicionar a linha de cima quando integrar com a api, por enquanto deixa o mock abaixo

  
  const productData = {
    model: 'Toyota Corolla',
    year: 2023,
    status: 'Usado',
    description: 'Lorem ipsum dolor sit amet. Quo nesciunt accusamus qui enim repellat quo iure Lorem ipsum dolor sit amet.',
    imageUrls: ['/path/to/your/product-image.png'],
  };

  // const handleSchedule = (selectedDate: Date) => {
  //   console.log('Agendamento solicitado para a data:', selectedDate);
  //   alert(`Agendamento para ${selectedDate.toLocaleDateString()} solicitado!`);
  // };


  return (
    <div className="p-8 max-w-7xl mx-auto">
      <Breadcrumb itemName={productData.model} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        <ProductDetails {...productData} />

        {/* // <BookingCalendar onSchedule={handleSchedule} /> */}
      </div>
    </div>
  );
};

export default SchedulerPage;