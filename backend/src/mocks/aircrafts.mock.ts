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
  }
];
