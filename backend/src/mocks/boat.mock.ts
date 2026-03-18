export interface BoatMock {
  marca: string;
  modelo: string;
  valor: number;
  ano: number;
  fabricante: string;
  tamanho: string;
  estilo: string;
  combustivel: string;
  motor: string;
  ano_motor: number;
  descricao_completa: string;
  acessorios: string;
  estado: string;
  tipo_embarcacao: string;
  specialist_id?: string;
  images: { url: string; is_primary: boolean }[];
}

export const mockBoats: BoatMock[] = [
  {
    marca: 'Azimut',
    modelo: 'Atlantis 43',
    descricao_completa:
      'Iate de luxo com design moderno e interior espaçoso. Equipado com 2 cabines, ar-condicionado, gerador, sistema de som premium e plataforma de banho.',
    valor: 1550000,
    ano: 2024,
    fabricante: 'Azimut Yachts',
    tamanho: '43 pés',
    estilo: 'Flybridge',
    combustivel: 'Diesel',
    motor: 'Volvo Penta IPS 600',
    ano_motor: 2024,
    acessorios:
      'GPS, Radar, Piloto Automático, Ar-condicionado, Gerador, Plataforma de banho',
    estado: 'Novo',
    tipo_embarcacao: 'Iate',
    images: [
      {
        url: 'https://www.azimutyachts.com.br/pub/uploads/2022/04/Azimut-A51-External-View-3-1024x576.jpg',
        is_primary: true,
      },
      {
        url: 'https://www.azimutyachts.com.br/pub/uploads/2022/04/Azimut-A51-External-View-3-1024x576.jpg',
        is_primary: false,
      },
    ],
  },
];
