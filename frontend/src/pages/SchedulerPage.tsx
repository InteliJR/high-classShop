import ProductDetails from "../components/product/ProductDetails";
import Breadcrumb from "../components/ui/Breadcrumb";
import BookingCalendar from "../components/booking/BookingCalendar";
import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";

//  import { useParams } from 'react-router-dom';
//  import { useEffect, useState } from 'react';
//  import ProductCard from '../components/product/ProductCard';
//  import BookingCalendar from '../components/booking/BookingCalendar';

const SchedulerPage = () => {
  const { id, categoria } = useParams<{ id: string; categoria: string }>();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [productData, setProductData] = useState({
    model: "",
    year: 0,
    status: "",
    description: "",
    imageUrls: [] as string[],
  });

  useEffect(() => {
    async function fetchData() {
      if (!id || !categoria) return;
      try {
        setLoading(true);
        setError(null);
        const resource =
          categoria === "carros"
            ? "cars"
            : categoria === "barcos"
            ? "boats"
            : "aircraft";
        const apiBaseUrl =
          import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api";
        const res = await fetch(`${apiBaseUrl}/${resource}/${id}`);
        if (!res.ok) throw new Error("Falha ao carregar o produto");
        const data = await res.json();
        setProductData({
          model: data.model,
          year: data.year,
          status: data.status,
          description: data.description ?? "",
          imageUrls: (data.images ?? []).map((i: { url: string }) => i.url),
        });
      } catch (e: any) {
        setError(e.message || "Erro inesperado");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [id, categoria]);

  // const handleSchedule = (selectedDate: Date) => {
  //   console.log('Agendamento solicitado para a data:', selectedDate);
  //   alert(`Agendamento para ${selectedDate.toLocaleDateString()} solicitado!`);
  // };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-3 border-gray-200 border-t-primary rounded-full animate-spin" />
          <p className="text-gray-600">Carregando agenda...</p>
        </div>
      </div>
    );
  }
  if (error) {
    return <div className="p-8 max-w-7xl mx-auto text-red-600">{error}</div>;
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <Breadcrumb
        category={
          categoria === "carros"
            ? "Carros"
            : categoria === "barcos"
            ? "Barcos"
            : "Aeronaves"
        }
        itemName={productData.model}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        <ProductDetails {...productData} />
        <BookingCalendar />
      </div>
    </div>
  );
};

export default SchedulerPage;
