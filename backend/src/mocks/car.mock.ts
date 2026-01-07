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
  {
    marca: 'Lamborghini',
    modelo: 'Huracán EVO',
    descricao:
      'Supercarro V10 de 640cv com tração integral e aerodinâmica ativa. Design agressivo e desempenho extremo.',
    valor: 2500000,
    estado: 'Novo',
    ano: 2024,
    cor: 'Verde Mantis',
    km: 0,
    cambio: 'Automático',
    combustivel: 'Gasolina',
    tipo_categoria: 'Esportivo',
    images: [
      { url: 'cars/1/pexels-photo-358070.jpeg', is_primary: true },
      { url: 'cars/1/pexels-photo-358070.jpeg', is_primary: false },
    ],
  },
  {
    marca: 'Mercedes-Benz',
    modelo: 'S 500 4MATIC',
    descricao:
      'Luxo e conforto supremos com motor V8 biturbo de 435cv. Tecnologia MBUX, suspensão pneumática e acabamento impecável.',
    valor: 850000,
    estado: 'Novo',
    ano: 2024,
    cor: 'Preto Obsidiana',
    km: 0,
    cambio: 'Automático',
    combustivel: 'Gasolina',
    tipo_categoria: 'Sedan',
    images: [
      { url: 'cars/1/pexels-photo-358070.jpeg', is_primary: true },
      { url: 'cars/1/pexels-photo-358070.jpeg', is_primary: false },
      { url: 'cars/1/pexels-photo-358070.jpeg', is_primary: false },
    ],
  },
  {
    marca: 'Range Rover',
    modelo: 'Autobiography LWB',
    descricao:
      'SUV de luxo com entre-eixos alongado, interior em couro Windsor e madeira nobre. Motor V8 supercharged de 565cv.',
    valor: 1200000,
    estado: 'Novo',
    ano: 2024,
    cor: 'Branco Byron',
    km: 0,
    cambio: 'Automático',
    combustivel: 'Gasolina',
    tipo_categoria: 'SUV',
    images: [
      { url: 'cars/1/pexels-photo-358070.jpeg', is_primary: true },
      { url: 'cars/1/pexels-photo-358070.jpeg', is_primary: false },
    ],
  },
  {
    marca: 'Ferrari',
    modelo: 'F8 Tributo',
    descricao:
      'V8 biturbo de 720cv com 0-100 em 2.9s. Herdeiro da lendária 488, com design italiano inconfundível.',
    valor: 3800000,
    estado: 'Novo',
    ano: 2024,
    cor: 'Rosso Corsa',
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
  {
    marca: 'Bentley',
    modelo: 'Continental GT',
    descricao:
      'Gran turismo com motor W12 de 635cv. Combinação perfeita de luxo britânico e desempenho esportivo.',
    valor: 2200000,
    estado: 'Novo',
    ano: 2024,
    cor: 'Azul Sequin',
    km: 0,
    cambio: 'Automático',
    combustivel: 'Gasolina',
    tipo_categoria: 'Cupê',
    images: [
      { url: 'cars/1/pexels-photo-358070.jpeg', is_primary: true },
      { url: 'cars/1/pexels-photo-358070.jpeg', is_primary: false },
    ],
  },
  {
    marca: 'Aston Martin',
    modelo: 'DB12',
    descricao:
      'GT de luxo com V8 biturbo de 680cv. Elegância britânica e tecnologia de ponta para viagens transcontinentais.',
    valor: 1900000,
    estado: 'Novo',
    ano: 2024,
    cor: 'Verde British Racing',
    km: 0,
    cambio: 'Automático',
    combustivel: 'Gasolina',
    tipo_categoria: 'Cupê',
    images: [
      { url: 'cars/1/pexels-photo-358070.jpeg', is_primary: true },
      { url: 'cars/1/pexels-photo-358070.jpeg', is_primary: false },
      { url: 'cars/1/pexels-photo-358070.jpeg', is_primary: false },
    ],
  },
  {
    marca: 'Rolls-Royce',
    modelo: 'Phantom Extended',
    descricao:
      'O ápice do luxo automotivo. Motor V12 de 571cv, interior totalmente personalizável com acabamento artesanal.',
    valor: 5500000,
    estado: 'Novo',
    ano: 2024,
    cor: 'Prata Arctic',
    km: 0,
    cambio: 'Automático',
    combustivel: 'Gasolina',
    tipo_categoria: 'Sedan',
    images: [
      { url: 'cars/1/pexels-photo-358070.jpeg', is_primary: true },
      { url: 'cars/1/pexels-photo-358070.jpeg', is_primary: false },
    ],
  },
  {
    marca: 'McLaren',
    modelo: '720S Spider',
    descricao:
      'Superesportivo conversível com motor V8 biturbo de 720cv. Teto retrátil e tecnologia de carbono.',
    valor: 4200000,
    estado: 'Seminovo',
    ano: 2023,
    cor: 'Laranja Papaya',
    km: 2500,
    cambio: 'Automático',
    combustivel: 'Gasolina',
    tipo_categoria: 'Esportivo',
    images: [
      { url: 'cars/1/pexels-photo-358070.jpeg', is_primary: true },
      { url: 'cars/1/pexels-photo-358070.jpeg', is_primary: false },
    ],
  },
  {
    marca: 'Maserati',
    modelo: 'MC20',
    descricao:
      'Supercarro italiano com motor V6 Nettuno de 630cv. Design esculpido pelo vento e som inconfundível.',
    valor: 2800000,
    estado: 'Novo',
    ano: 2024,
    cor: 'Blu Infinito',
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
