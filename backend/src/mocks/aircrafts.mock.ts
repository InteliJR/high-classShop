export interface AircraftMock {
  categoria: string;
  ano: number;
  marca: string;
  modelo: string;
  assentos: number;
  estado: string;
  descricao: string;
  valor: number;
  tipo_aeronave: string;
  images: { url: string; is_primary: boolean }[];
}

export const mockAircrafts: AircraftMock[] = [
  {
    marca: "Embraer",
    modelo: "Phenom 300E",
    descricao: "Jato executivo de alto padrão com autonomia de 3.650 km e luxo inigualável. Cabine para 9 passageiros com acabamento em couro, sistema de entretenimento individual e lavatory completo.",
    valor: 9500000,
    ano: 2024,
    categoria: "Jato Leve",
    assentos: 9,
    estado: "Novo",
    tipo_aeronave: "Jato Executivo",
    images: [
      { url: "https://s2-g1.glbimg.com/GaQbI-RnPtqQeOgFBF__9lscVZc=/0x0:2400x1600/1008x0/smart/filters:strip_icc()/i.s3.glbimg.com/v1/AUTH_59edd422c0c84a879bd37670ae4f538a/internal_photos/bs/2017/6/X/rhodV8TMiaXl6yQcpDmw/2017-10-09t182910z-625694718-rc19aca9ba50-rtrmadp-3-embraer-phenom.jpg", is_primary: true },
      { url: "https://images.aircharterservice.com/global/aircraft-guide/private-charter/beechcraft-king-air-350.jpg", is_primary: false },
    ],
  },
  {
    marca: "Gulfstream",
    modelo: "G650ER",
    descricao: "Um dos jatos mais luxuosos e rápidos do mundo, com alcance intercontinental de 13.890 km. Cabine ultramoderna para 19 passageiros, cozinha gourmet e conectividade global via satélite.",
    valor: 70000000,
    ano: 2024,
    categoria: "Jato Ultra Longo Alcance",
    assentos: 19,
    estado: "Novo",
    tipo_aeronave: "Jato Executivo",
    images: [
      { url: "https://static0.simpleflyingimages.com/wordpress/wp-content/uploads/2024/01/ext2c_072-20231115-2.jpg", is_primary: true },
      { url: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRON8s58Qhyhrh_TJJBWCN2RQzcOAnwJWliZg&s", is_primary: false },
      { url: "https://images.aircharterservice.com/global/aircraft-guide/private-charter/beechcraft-king-air-350.jpg", is_primary: false },
    ],
  },
  {
    marca: "Bombardier",
    modelo: "Global 7500",
    descricao: "Jato de longo alcance com autonomia de 14.260 km. 4 zonas de living, suite master com chuveiro, sistema de entretenimento 4K e cozinha completa.",
    valor: 75000000,
    ano: 2024,
    categoria: "Jato Ultra Longo Alcance",
    assentos: 17,
    estado: "Novo",
    tipo_aeronave: "Jato Executivo",
    images: [
      { url: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRON8s58Qhyhrh_TJJBWCN2RQzcOAnwJWliZg&s", is_primary: true },
      { url: "https://static0.simpleflyingimages.com/wordpress/wp-content/uploads/2024/01/ext2c_072-20231115-2.jpg", is_primary: false },
    ],
  },
  {
    marca: "Cessna",
    modelo: "Citation Latitude",
    descricao: "Jato médio com excelente custo-benefício. Cabine espaçosa para 9 passageiros, autonomia de 4.800 km e tecnologia Garmin G5000.",
    valor: 18000000,
    ano: 2023,
    categoria: "Jato Médio",
    assentos: 9,
    estado: "Seminovo",
    tipo_aeronave: "Jato Executivo",
    images: [
      { url: "https://images.aircharterservice.com/global/aircraft-guide/private-charter/beechcraft-king-air-350.jpg", is_primary: true },
      { url: "https://aviationconsumer.com/wp-content/uploads/2020/11/MatrixLede.jpg", is_primary: false },
    ],
  },
  {
    marca: "Dassault",
    modelo: "Falcon 8X",
    descricao: "Jato trimotor de longo alcance com 11.945 km de autonomia. Cabine luxuosa para 16 passageiros, tecnologia fly-by-wire e eficiência operacional superior.",
    valor: 58000000,
    ano: 2024,
    categoria: "Jato Longo Alcance",
    assentos: 16,
    estado: "Novo",
    tipo_aeronave: "Jato Executivo",
    images: [
      { url: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRON8s58Qhyhrh_TJJBWCN2RQzcOAnwJWliZg&s", is_primary: true },
      { url: "https://s2-g1.glbimg.com/GaQbI-RnPtqQeOgFBF__9lscVZc=/0x0:2400x1600/1008x0/smart/filters:strip_icc()/i.s3.glbimg.com/v1/AUTH_59edd422c0c84a879bd37670ae4f538a/internal_photos/bs/2017/6/X/rhodV8TMiaXl6yQcpDmw/2017-10-09t182910z-625694718-rc19aca9ba50-rtrmadp-3-embraer-phenom.jpg", is_primary: false },
    ],
  },
  {
    marca: "Beechcraft",
    modelo: "King Air 360",
    descricao: "Turboélice executivo com conforto e desempenho excepcionais. Autonomia de 3.300 km, cabine pressurizada para 9 passageiros e aviônica Collins Aerospace Pro Line Fusion.",
    valor: 8500000,
    ano: 2024,
    categoria: "Turboélice",
    assentos: 9,
    estado: "Novo",
    tipo_aeronave: "Turboélice Executivo",
    images: [
      { url: "https://images.aircharterservice.com/global/aircraft-guide/private-charter/beechcraft-king-air-350.jpg", is_primary: true },
      { url: "https://aviationconsumer.com/wp-content/uploads/2020/11/MatrixLede.jpg", is_primary: false },
    ],
  },
  {
    marca: "Cirrus",
    modelo: "SF50 Vision Jet",
    descricao: "Primeiro jato pessoal monomotor certificado. Equipado com paraquedas balístico CAPS, autonomia de 1.850 km e capacidade para 5 passageiros. Perfeito para viagens executivas curtas.",
    valor: 3200000,
    ano: 2024,
    categoria: "Jato Muito Leve",
    assentos: 5,
    estado: "Novo",
    tipo_aeronave: "Jato Executivo",
    images: [
      { url: "https://images.aircharterservice.com/global/aircraft-guide/private-charter/cirrus-sr22.jpg", is_primary: true },
      { url: "https://aviationconsumer.com/wp-content/uploads/2020/11/MatrixLede.jpg", is_primary: false },
    ],
  },
  {
    marca: "Pilatus",
    modelo: "PC-24",
    descricao: "Super versátil jato leve com capacidade STOL (decolagem e pouso curtos). Cabine configurável para 10 passageiros, porta cargo e autonomia de 3.500 km.",
    valor: 12000000,
    ano: 2024,
    categoria: "Jato Leve",
    assentos: 10,
    estado: "Novo",
    tipo_aeronave: "Jato Executivo",
    images: [
      { url: "https://images.aircharterservice.com/global/aircraft-guide/private-charter/beechcraft-king-air-350.jpg", is_primary: true },
      { url: "https://s2-g1.glbimg.com/GaQbI-RnPtqQeOgFBF__9lscVZc=/0x0:2400x1600/1008x0/smart/filters:strip_icc()/i.s3.glbimg.com/v1/AUTH_59edd422c0c84a879bd37670ae4f538a/internal_photos/bs/2017/6/X/rhodV8TMiaXl6yQcpDmw/2017-10-09t182910z-625694718-rc19aca9ba50-rtrmadp-3-embraer-phenom.jpg", is_primary: false },
    ],
  },
  {
    marca: "Honda",
    modelo: "HondaJet Elite II",
    descricao: "Jato leve inovador com motores sobre as asas. Tecnologia Honda, autonomia de 2.625 km, cabine para 6 passageiros e eficiência de combustível superior.",
    valor: 7500000,
    ano: 2024,
    categoria: "Jato Leve",
    assentos: 6,
    estado: "Novo",
    tipo_aeronave: "Jato Executivo",
    images: [
      { url: "https://aviationconsumer.com/wp-content/uploads/2020/11/MatrixLede.jpg", is_primary: true },
      { url: "https://images.aircharterservice.com/global/aircraft-guide/private-charter/cirrus-sr22.jpg", is_primary: false },
    ],
  },
  {
    marca: "Embraer",
    modelo: "Praetor 600",
    descricao: "Jato super médio com alcance de 7.400 km. Cabine para 12 passageiros com altitude de cabine mais baixa da categoria, conectividade Ka-band e suite executiva.",
    valor: 25000000,
    ano: 2023,
    categoria: "Jato Super Médio",
    assentos: 12,
    estado: "Seminovo",
    tipo_aeronave: "Jato Executivo",
    images: [
      { url: "https://s2-g1.glbimg.com/GaQbI-RnPtqQeOgFBF__9lscVZc=/0x0:2400x1600/1008x0/smart/filters:strip_icc()/i.s3.glbimg.com/v1/AUTH_59edd422c0c84a879bd37670ae4f538a/internal_photos/bs/2017/6/X/rhodV8TMiaXl6yQcpDmw/2017-10-09t182910z-625694718-rc19aca9ba50-rtrmadp-3-embraer-phenom.jpg", is_primary: true },
      { url: "https://images.aircharterservice.com/global/aircraft-guide/private-charter/beechcraft-king-air-350.jpg", is_primary: false },
      { url: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRON8s58Qhyhrh_TJJBWCN2RQzcOAnwJWliZg&s", is_primary: false },
    ],
  },
];