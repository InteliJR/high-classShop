import { useState } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';

interface BookingCalendarProps {
  onSchedule?: (date: Date) => void;
}

export default function BookingCalendar({ onSchedule }: BookingCalendarProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  function handleScheduleClick() {
    if (onSchedule) onSchedule(selectedDate);
  }

  return (
    <div className="bg-color-bg-container rounded-lg shadow p-4 h-fit">
      <Calendar value={selectedDate} onChange={(d) => setSelectedDate(d as Date)} locale="pt-BR" />

      <div className="flex justify-end mt-4">
        <button
          type="button"
          className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700"
          onClick={handleScheduleClick}
        >
          Agendar
        </button>
      </div>
    </div>
  );
}


