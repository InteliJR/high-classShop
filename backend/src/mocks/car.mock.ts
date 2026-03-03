export interface CarMock {
  marca: string;
  modelo: string;
  valor: number;
  estado: string;
  ano: number;
  descricao: string;
  cor: string;
  km: number;
  cambio: string;
  combustivel: string;
  tipo_categoria: string;
  specialist_id?: string;
  images: { url: string; is_primary: boolean }[];
}

export const mockCars: CarMock[] = [
  {
    marca: 'Porsche',
    modelo: '911 Carrera S',
    descricao:
      'Ícone esportivo com motor boxer de 450cv, 0-100 em 3.5s. Interior em couro premium, sistema de som Burmester e tecnologia de ponta.',
    valor: 950000,
    estado: 'Novo',
    ano: 2024,
    cor: 'Cinza Racing',
    km: 0,
    cambio: 'Automático',
    combustivel: 'Gasolina',
    tipo_categoria: 'Esportivo',
    images: [
      { url: 'cars/1/pexels-photo-358070.jpeg', is_primary: true },
      { url: 'cars/1/pexels-photo-358070.jpeg', is_primary: false },
      { url: 'cars/1/pexels-photo-358070.jpeg', is_primary: false },
    ],
  },
];
