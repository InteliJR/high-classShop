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
      { url: 'boats/1/Azimut-Atlantis-43-review-external2-credit-Azimut-Yachts.jpg', is_primary: true },
      { url: 'boats/1/Azimut-Atlantis-43-review-external2-credit-Azimut-Yachts.jpg', is_primary: false },
    ],
  },
  {
    marca: 'Ferretti',
    modelo: '550 Flybridge',
    descricao_completa:
      'Barco de alto padrão com desempenho e conforto premium. 3 cabines luxuosas, deck espaçoso, sistema de estabilização e acabamento em madeira nobre.',
    valor: 2600000,
    ano: 2023,
    fabricante: 'Ferretti Yachts',
    tamanho: '55 pés',
    estilo: 'Flybridge',
    combustivel: 'Diesel',
    motor: 'MAN V8 1200',
    ano_motor: 2023,
    acessorios:
      'Sistema de estabilização, Ar-condicionado central, Gerador Onan, Tender com motor, Sistema de som Bose',
    estado: 'Seminovo',
    tipo_embarcacao: 'Iate',
    images: [
      { url: 'boats/1/Azimut-Atlantis-43-review-external2-credit-Azimut-Yachts.jpg', is_primary: true },
      { url: 'boats/1/Azimut-Atlantis-43-review-external2-credit-Azimut-Yachts.jpg', is_primary: false },
    ],
  },
  {
    marca: 'Sunseeker',
    modelo: 'Manhattan 66',
    descricao_completa:
      'Iate britânico de 66 pés com linhas elegantes e performance excepcional. 4 cabines, sky lounge, garage para jet ski e acabamento artesanal.',
    valor: 4200000,
    ano: 2024,
    fabricante: 'Sunseeker International',
    tamanho: '66 pés',
    estilo: 'Flybridge',
    combustivel: 'Diesel',
    motor: 'MAN V12 1550',
    ano_motor: 2024,
    acessorios:
      'Sistema de estabilização Seakeeper, Ar-condicionado, 2 Geradores, Garage para jet ski, Cinema room',
    estado: 'Novo',
    tipo_embarcacao: 'Iate',
    images: [
      { url: 'boats/1/Azimut-Atlantis-43-review-external2-credit-Azimut-Yachts.jpg', is_primary: true },
      { url: 'boats/1/Azimut-Atlantis-43-review-external2-credit-Azimut-Yachts.jpg', is_primary: false },
    ],
  },
  {
    marca: 'Princess',
    modelo: 'X95 Superfly',
    descricao_completa:
      'Superyacht de 95 pés com tecnologia de ponta. 5 suítes, beach club, jacuzzi no flybridge e sistema de propulsão híbrido.',
    valor: 12500000,
    ano: 2024,
    fabricante: 'Princess Yachts',
    tamanho: '95 pés',
    estilo: 'Superfly',
    combustivel: 'Diesel/Híbrido',
    motor: 'MAN V12 1900 + Propulsão Elétrica',
    ano_motor: 2024,
    acessorios:
      'Sistema híbrido, Jacuzzi, Beach club, Sistema de estabilização, 3 Geradores, Tender 4.3m com 60hp',
    estado: 'Novo',
    tipo_embarcacao: 'Superyacht',
    images: [
      { url: 'boats/1/Azimut-Atlantis-43-review-external2-credit-Azimut-Yachts.jpg', is_primary: true },
      { url: 'boats/1/Azimut-Atlantis-43-review-external2-credit-Azimut-Yachts.jpg', is_primary: false },
    ],
  },
  {
    marca: 'Beneteau',
    modelo: 'Oceanis 51.1',
    descricao_completa:
      'Veleiro de cruzeiro com excelente desempenho e conforto. 4 cabines, cockpit espaçoso, velas elétricas e equipamento de navegação completo.',
    valor: 1200000,
    ano: 2024,
    fabricante: 'Beneteau',
    tamanho: '51 pés',
    estilo: 'Veleiro',
    combustivel: 'Diesel',
    motor: 'Yanmar 80hp',
    ano_motor: 2024,
    acessorios:
      'Velas elétricas, GPS/Ploter, Piloto automático, Gerador, Ar-condicionado, Dessalinizador',
    estado: 'Novo',
    tipo_embarcacao: 'Veleiro',
    images: [
      { url: 'boats/1/Azimut-Atlantis-43-review-external2-credit-Azimut-Yachts.jpg', is_primary: true },
      { url: 'boats/1/Azimut-Atlantis-43-review-external2-credit-Azimut-Yachts.jpg', is_primary: false },
    ],
  },
  {
    marca: 'Sea Ray',
    modelo: 'SPX 230',
    descricao_completa:
      'Lancha esportiva versátil para esportes aquáticos e passeios em família. Torre para wakeboard, sistema de som marine e acabamento premium.',
    valor: 320000,
    ano: 2024,
    fabricante: 'Sea Ray',
    tamanho: '23 pés',
    estilo: 'Bowrider',
    combustivel: 'Gasolina',
    motor: 'MerCruiser 300hp',
    ano_motor: 2024,
    acessorios:
      'Torre wakeboard, Sistema de som JL Audio, GPS, Bimini top, Capa',
    estado: 'Novo',
    tipo_embarcacao: 'Lancha',
    images: [
      { url: 'boats/1/Azimut-Atlantis-43-review-external2-credit-Azimut-Yachts.jpg', is_primary: true },
      { url: 'boats/1/Azimut-Atlantis-43-review-external2-credit-Azimut-Yachts.jpg', is_primary: false },
    ],
  },
  {
    marca: 'Cigarette',
    modelo: '42 Huntress',
    descricao_completa:
      'Lancha de alta performance com motores triplos totalizando 1350hp. Design agressivo, cockpit racing e tecnologia Mercury Racing.',
    valor: 2800000,
    ano: 2024,
    fabricante: 'Cigarette Racing Team',
    tamanho: '42 pés',
    estilo: 'Center Console',
    combustivel: 'Gasolina',
    motor: 'Mercury Racing 450R (triplo)',
    ano_motor: 2024,
    acessorios:
      'Sistema Garmin completo, T-top carbono, Livewell, Sistema de som JL Audio M-Series',
    estado: 'Novo',
    tipo_embarcacao: 'Lancha',
    images: [
      { url: 'boats/1/Azimut-Atlantis-43-review-external2-credit-Azimut-Yachts.jpg', is_primary: true },
      { url: 'boats/1/Azimut-Atlantis-43-review-external2-credit-Azimut-Yachts.jpg', is_primary: false },
    ],
  },
  {
    marca: 'Intermarine',
    modelo: '60 Full',
    descricao_completa:
      'Iate nacional de alto padrão com 60 pés. 3 suítes, flybridge amplo, garage para jet ski e acabamento em marcenaria brasileira.',
    valor: 3200000,
    ano: 2023,
    fabricante: 'Intermarine',
    tamanho: '60 pés',
    estilo: 'Flybridge',
    combustivel: 'Diesel',
    motor: 'MAN V8 1000',
    ano_motor: 2023,
    acessorios:
      'Ar-condicionado, Gerador Kohler, GPS/Radar Garmin, Piloto automático, Plataforma hidráulica',
    estado: 'Seminovo',
    tipo_embarcacao: 'Iate',
    images: [
      { url: 'boats/1/Azimut-Atlantis-43-review-external2-credit-Azimut-Yachts.jpg', is_primary: true },
      { url: 'boats/1/Azimut-Atlantis-43-review-external2-credit-Azimut-Yachts.jpg', is_primary: false },
    ],
  },
  {
    marca: 'Yamaha',
    modelo: '275 SD',
    descricao_completa:
      'Lancha jet boat versátil e econômica. Ideal para família, com cabine, banheiro e ótimo desempenho com motores a jato.',
    valor: 450000,
    ano: 2024,
    fabricante: 'Yamaha Marine',
    tamanho: '27 pés',
    estilo: 'Jet Boat',
    combustivel: 'Gasolina',
    motor: 'Yamaha Jet 1.8L (duplo)',
    ano_motor: 2024,
    acessorios:
      'GPS Simrad, Sistema de som Fusion, Bimini top, Mesa cockpit, Ancora',
    estado: 'Novo',
    tipo_embarcacao: 'Lancha',
    images: [
      { url: 'boats/1/Azimut-Atlantis-43-review-external2-credit-Azimut-Yachts.jpg', is_primary: true },
      { url: 'boats/1/Azimut-Atlantis-43-review-external2-credit-Azimut-Yachts.jpg', is_primary: false },
    ],
  },
  {
    marca: 'Boston Whaler',
    modelo: '380 Outrage',
    descricao_completa:
      'Center console premium com triplos Mercury Verado 350hp. Perfeito para pesca esportiva e passeios offshore.',
    valor: 2100000,
    ano: 2024,
    fabricante: 'Boston Whaler',
    tamanho: '38 pés',
    estilo: 'Center Console',
    combustivel: 'Gasolina',
    motor: 'Mercury Verado 350hp (triplo)',
    ano_motor: 2024,
    acessorios:
      'T-top, Livewell, Sistema Garmin completo, Ar-condicionado cabine, Gerador',
    estado: 'Novo',
    tipo_embarcacao: 'Lancha',
    images: [
      { url: 'boats/1/Azimut-Atlantis-43-review-external2-credit-Azimut-Yachts.jpg', is_primary: true },
      { url: 'boats/1/Azimut-Atlantis-43-review-external2-credit-Azimut-Yachts.jpg', is_primary: false },
    ],
  },
];
