import { Prisma } from '@prisma/client';

export const publicCatalogSpecialistSelect = {
  id: true,
  name: true,
  surname: true,
} satisfies Prisma.UserSelect;

export const publicCatalogImageSelect = {
  id: true,
  image_url: true,
  is_primary: true,
} satisfies Prisma.Car_imageSelect &
  Prisma.Boat_imageSelect &
  Prisma.Aircraft_imageSelect;

export const publicCarSelect = {
  id: true,
  specialist_id: true,
  is_active: true,
  marca: true,
  modelo: true,
  identificador: true,
  valor: true,
  currency: true,
  estado: true,
  ano: true,
  descricao: true,
  cor: true,
  km: true,
  cambio: true,
  combustivel: true,
  tipo_categoria: true,
  created_at: true,
  updated_at: true,
  images: { select: publicCatalogImageSelect },
  specialist: { select: publicCatalogSpecialistSelect },
} satisfies Prisma.CarSelect;

export const publicBoatSelect = {
  id: true,
  specialist_id: true,
  is_active: true,
  marca: true,
  modelo: true,
  identificador: true,
  valor: true,
  currency: true,
  ano: true,
  fabricante: true,
  tamanho: true,
  estilo: true,
  combustivel: true,
  motor: true,
  ano_motor: true,
  descricao_completa: true,
  acessorios: true,
  estado: true,
  tipo_embarcacao: true,
  created_at: true,
  updated_at: true,
  images: { select: publicCatalogImageSelect },
  specialist: { select: publicCatalogSpecialistSelect },
} satisfies Prisma.BoatSelect;

export const publicAircraftSelect = {
  id: true,
  specialist_id: true,
  is_active: true,
  categoria: true,
  ano: true,
  marca: true,
  modelo: true,
  identificador: true,
  assentos: true,
  estado: true,
  descricao: true,
  valor: true,
  currency: true,
  tipo_aeronave: true,
  created_at: true,
  updated_at: true,
  images: { select: publicCatalogImageSelect },
  specialist: { select: publicCatalogSpecialistSelect },
} satisfies Prisma.AircraftSelect;
