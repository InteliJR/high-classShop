// src/components/booking/BookingCalendar.tsx
import { useState } from 'react'; // React Hook para guardar o estado da data
import Button from '../ui/Button'; // Importamos nosso botão reutilizável

interface BookingCalendarProps {
  onSchedule: (selectedDate: Date) => void;
}

const BookingCalendar = ({ onSchedule }: BookingCalendarProps) => {
  // Guarda a data que o usuário selecionou. O valor inicial é a data de hoje.
  const [selectedDate, setSelectedDate] = useState(new Date());

  const handleButtonClick = () => {
    // Quando o botão é clicado, chamamos a função que recebemos do componente "pai"
    onSchedule(selectedDate);
  };

  return (
    <div className="p-6 border rounded-xl shadow-md flex flex-col items-center gap-6">
      <h3 className="text-lg font-bold">October 2020</h3>
      {/* Aqui entraria um componente de calendário de verdade (ex: uma biblioteca como react-day-picker)
        ou a lógica para renderizar os dias do mês. Por simplicidade, vamos apenas mostrar a data selecionada.
      */}
      <div className="bg-gray-100 p-4 rounded-lg w-full text-center">
        <p>Data Selecionada:</p>
        <p className="font-bold text-xl">{selectedDate.toLocaleDateString()}</p>
        <p className="text-sm mt-2">(Interface do calendário a ser implementada)</p>
      </div>

      <Button onClick={handleButtonClick} variant="primary">
        Agendar
      </Button>
    </div>
  );
};

export default BookingCalendar;