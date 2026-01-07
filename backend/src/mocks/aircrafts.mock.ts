export interface AircraftMock {
  marca: string;
  modelo: string;
  valor: number;
  estado: string;
  ano: number;
  descricao: string;
  capacidade_passageiros: number;
  velocidade_maxima: number;
  alcance_maximo: number;
  tipo_aeronave: string;
  motores: string;
  horas_voo: number;
  specialist_id?: string;
  images: { url: string; is_primary: boolean }[];
}

export const mockAircrafts: AircraftMock[] = [
  {
    marca: 'Embraer',
    modelo: 'Phenom 300E',
    descricao:
      'Jato executivo leve com aviónica Prodigy Touch, bancos reclináveis de couro, sistema de entretenimento e conectividade via satélite.',
    valor: 45000000,
    estado: 'Novo',
    ano: 2024,
    capacidade_passageiros: 9,
    velocidade_maxima: 839,
    alcance_maximo: 3650,
    tipo_aeronave: 'Jato Executivo',
    motores: 'Pratt & Whitney Canada PW535E1',
    horas_voo: 0,
    images: [
      { url: 'aircrafts/1/2017-10-09t182910z-625694718-rc19aca9ba50-rtrmadp-3-embraer-phenom.webp', is_primary: true },
      { url: 'aircrafts/1/2017-10-09t182910z-625694718-rc19aca9ba50-rtrmadp-3-embraer-phenom.webp', is_primary: false },
    ],
  },
  {
    marca: 'Cessna',
    modelo: 'Citation Longitude',
    descricao:
      'Jato super-midsize com cabine ampla, Wi-Fi de alta velocidade, aviónica Garmin G5000 e autonomia transcontinental.',
    valor: 120000000,
    estado: 'Novo',
    ano: 2024,
    capacidade_passageiros: 12,
    velocidade_maxima: 916,
    alcance_maximo: 6482,
    tipo_aeronave: 'Jato Executivo',
    motores: 'Honeywell HTF7700L',
    horas_voo: 0,
    images: [
      { url: 'aircrafts/1/2017-10-09t182910z-625694718-rc19aca9ba50-rtrmadp-3-embraer-phenom.webp', is_primary: true },
      { url: 'aircrafts/1/2017-10-09t182910z-625694718-rc19aca9ba50-rtrmadp-3-embraer-phenom.webp', is_primary: false },
    ],
  },
  {
    marca: 'Gulfstream',
    modelo: 'G700',
    descricao:
      'O ápice da aviação executiva com cabine ultra-larga, 5 áreas de estar, cama king-size, chuveiro e alcance intercontinental.',
    valor: 350000000,
    estado: 'Novo',
    ano: 2024,
    capacidade_passageiros: 19,
    velocidade_maxima: 1142,
    alcance_maximo: 13890,
    tipo_aeronave: 'Jato Executivo',
    motores: 'Rolls-Royce Pearl 700',
    horas_voo: 0,
    images: [
      { url: 'aircrafts/1/2017-10-09t182910z-625694718-rc19aca9ba50-rtrmadp-3-embraer-phenom.webp', is_primary: true },
      { url: 'aircrafts/1/2017-10-09t182910z-625694718-rc19aca9ba50-rtrmadp-3-embraer-phenom.webp', is_primary: false },
    ],
  },
  {
    marca: 'Bombardier',
    modelo: 'Global 7500',
    descricao:
      'Jato de longo alcance com 4 zonas de estar, suíte master com banheiro completo e tecnologia de redução de fadiga.',
    valor: 320000000,
    estado: 'Novo',
    ano: 2024,
    capacidade_passageiros: 19,
    velocidade_maxima: 1120,
    alcance_maximo: 14260,
    tipo_aeronave: 'Jato Executivo',
    motores: 'GE Passport',
    horas_voo: 0,
    images: [
      { url: 'aircrafts/1/2017-10-09t182910z-625694718-rc19aca9ba50-rtrmadp-3-embraer-phenom.webp', is_primary: true },
      { url: 'aircrafts/1/2017-10-09t182910z-625694718-rc19aca9ba50-rtrmadp-3-embraer-phenom.webp', is_primary: false },
    ],
  },
  {
    marca: 'Dassault',
    modelo: 'Falcon 8X',
    descricao:
      'Tri-jato francês de ultra-longo alcance com cabine silenciosa, 3 motores para máxima segurança e eficiência.',
    valor: 280000000,
    estado: 'Novo',
    ano: 2024,
    capacidade_passageiros: 14,
    velocidade_maxima: 1075,
    alcance_maximo: 11945,
    tipo_aeronave: 'Jato Executivo',
    motores: 'Pratt & Whitney Canada PW307D',
    horas_voo: 0,
    images: [
      { url: 'aircrafts/1/2017-10-09t182910z-625694718-rc19aca9ba50-rtrmadp-3-embraer-phenom.webp', is_primary: true },
      { url: 'aircrafts/1/2017-10-09t182910z-625694718-rc19aca9ba50-rtrmadp-3-embraer-phenom.webp', is_primary: false },
    ],
  },
  {
    marca: 'Cirrus',
    modelo: 'SF50 Vision Jet',
    descricao:
      'Jato leve monomotor com paraquedas de emergência para toda a aeronave, ideal para pilotos proprietários.',
    valor: 12000000,
    estado: 'Novo',
    ano: 2024,
    capacidade_passageiros: 5,
    velocidade_maxima: 555,
    alcance_maximo: 2037,
    tipo_aeronave: 'Jato Executivo',
    motores: 'Williams FJ33-5A',
    horas_voo: 0,
    images: [
      { url: 'aircrafts/1/2017-10-09t182910z-625694718-rc19aca9ba50-rtrmadp-3-embraer-phenom.webp', is_primary: true },
      { url: 'aircrafts/1/2017-10-09t182910z-625694718-rc19aca9ba50-rtrmadp-3-embraer-phenom.webp', is_primary: false },
    ],
  },
  {
    marca: 'Pilatus',
    modelo: 'PC-24',
    descricao:
      'Super versatile jet com capacidade STOL para operar em pistas curtas de terra, ideal para acesso a locais remotos.',
    valor: 50000000,
    estado: 'Seminovo',
    ano: 2023,
    capacidade_passageiros: 11,
    velocidade_maxima: 815,
    alcance_maximo: 3704,
    tipo_aeronave: 'Jato Executivo',
    motores: 'Williams FJ44-4A',
    horas_voo: 450,
    images: [
      { url: 'aircrafts/1/2017-10-09t182910z-625694718-rc19aca9ba50-rtrmadp-3-embraer-phenom.webp', is_primary: true },
      { url: 'aircrafts/1/2017-10-09t182910z-625694718-rc19aca9ba50-rtrmadp-3-embraer-phenom.webp', is_primary: false },
    ],
  },
  {
    marca: 'Honda',
    modelo: 'HondaJet Elite S',
    descricao:
      'Jato leve inovador com motores sobre as asas, cabine espaçosa e eficiência excepcional. Ideal para voos regionais.',
    valor: 28000000,
    estado: 'Novo',
    ano: 2024,
    capacidade_passageiros: 6,
    velocidade_maxima: 778,
    alcance_maximo: 2661,
    tipo_aeronave: 'Jato Executivo',
    motores: 'GE Honda HF120',
    horas_voo: 0,
    images: [
      { url: 'aircrafts/1/2017-10-09t182910z-625694718-rc19aca9ba50-rtrmadp-3-embraer-phenom.webp', is_primary: true },
      { url: 'aircrafts/1/2017-10-09t182910z-625694718-rc19aca9ba50-rtrmadp-3-embraer-phenom.webp', is_primary: false },
    ],
  },
  {
    marca: 'Beechcraft',
    modelo: 'King Air 360',
    descricao:
      'Turbo-hélice bimotor confiável e econômico. Collins Aerospace Pro Line Fusion, cabine climatizada e baixo custo operacional.',
    valor: 35000000,
    estado: 'Novo',
    ano: 2024,
    capacidade_passageiros: 9,
    velocidade_maxima: 580,
    alcance_maximo: 3334,
    tipo_aeronave: 'Turbo-hélice',
    motores: 'Pratt & Whitney PT6A-60A',
    horas_voo: 0,
    images: [
      { url: 'aircrafts/1/2017-10-09t182910z-625694718-rc19aca9ba50-rtrmadp-3-embraer-phenom.webp', is_primary: true },
      { url: 'aircrafts/1/2017-10-09t182910z-625694718-rc19aca9ba50-rtrmadp-3-embraer-phenom.webp', is_primary: false },
    ],
  },
  {
    marca: 'Airbus',
    modelo: 'ACJ320neo',
    descricao:
      'Jato corporativo baseado no A320, configurado como palácio voador com quartos, salas de reunião, spa e alcance intercontinental.',
    valor: 450000000,
    estado: 'Novo',
    ano: 2024,
    capacidade_passageiros: 25,
    velocidade_maxima: 871,
    alcance_maximo: 11112,
    tipo_aeronave: 'Airliner Corporativo',
    motores: 'CFM LEAP-1A',
    horas_voo: 0,
    images: [
      { url: 'aircrafts/1/2017-10-09t182910z-625694718-rc19aca9ba50-rtrmadp-3-embraer-phenom.webp', is_primary: true },
      { url: 'aircrafts/1/2017-10-09t182910z-625694718-rc19aca9ba50-rtrmadp-3-embraer-phenom.webp', is_primary: false },
    ],
  },
];
