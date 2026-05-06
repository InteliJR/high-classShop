import ProductDetails from "../components/product/ProductDetails";
import Breadcrumb from "../components/ui/Breadcrumb";
import BookingCalendar from "../components/booking/BookingCalendar";
import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import type { Product } from "../types/types";

const normalizeProduct = (data: any): Product => {
  const normalizedImages = Array.isArray(data?.images)
    ? data.images
        .map((img: any, index: number) => ({
          id: img?.id ?? index,
          image_url: img?.image_url ?? img?.url ?? "",
          is_primary: Boolean(img?.is_primary),
        }))
        .filter((img: { image_url: string }) => Boolean(img.image_url))
    : undefined;

  return {
    id: data?.id ?? 0,
    marca: data?.marca ?? data?.brand ?? "",
    modelo: data?.modelo ?? data?.model ?? "",
    descricao: data?.descricao ?? data?.description,
    valor: Number(data?.valor ?? data?.price ?? 0),
    imageUrl:
      data?.imageUrl ?? data?.image_url ?? normalizedImages?.[0]?.image_url,
    images: normalizedImages,
    ano: data?.ano ?? data?.year,
    estado: data?.estado ?? data?.status,
    specialist_id: data?.specialist_id,
    cor: data?.cor,
    km: data?.km,
    cambio: data?.cambio,
    combustivel: data?.combustivel,
    tipo_categoria: data?.tipo_categoria,
    fabricante: data?.fabricante,
    tamanho: data?.tamanho,
    estilo: data?.estilo,
    motor: data?.motor,
    ano_motor: data?.ano_motor,
    tipo_embarcacao: data?.tipo_embarcacao,
    descricao_completa: data?.descricao_completa ?? data?.description_full,
    acessorios: data?.acessorios,
    categoria: data?.categoria,
    assentos: data?.assentos,
    tipo_aeronave: data?.tipo_aeronave,
  };
};

//  import { useParams } from 'react-router-dom';
//  import { useEffect, useState } from 'react';
//  import ProductCard from '../components/product/ProductCard';
//  import BookingCalendar from '../components/booking/BookingCalendar';

const SchedulerPage = () => {
  const { id, categoria } = useParams<{ id: string; categoria: string }>();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [productData, setProductData] = useState<Product | null>(null);

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
        setProductData(normalizeProduct(data));
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

  if (!productData) {
    return (
      <div className="p-8 max-w-7xl mx-auto text-gray-600">
        Produto não encontrado.
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <Breadcrumb
        category={
          categoria === "carros"
            ? "Carros"
            : categoria === "barcos"
              ? "Embarcações"
              : "Aeronaves"
        }
        itemName={productData.modelo || productData.marca}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        <ProductDetails product={productData} />
        <BookingCalendar />
      </div>
    </div>
  );
};

export default SchedulerPage;
