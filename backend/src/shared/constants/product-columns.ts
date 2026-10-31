import { XlsxColumnDefinition } from 'src/shared/services/xlsx-import.service';

/**
 * Fonte única das colunas de importação de produto.
 *
 * A ordem aqui define o header da planilha baixada pelo usuário e a ordem da
 * aba "Instruções". O parser casa por nome, então planilhas em outra ordem
 * continuam válidas. `description`/`example` alimentam a aba "Instruções".
 *
 * Só valor e moeda são obrigatórios: sem identificador, o import gera um a
 * partir dos dados da linha; sem marca/modelo/estado, o produto recebe
 * valores padrão (ver product-import-jobs.service.ts).
 *
 * Antes existiam três cópias destas listas (um par por tipo de produto, em
 * `{cars,boats,aircrafts}.service.ts` e em `product-import-jobs.service.ts`).
 * O template era gerado de uma cópia e o import validado contra a outra, então
 * adicionar uma coluna só na primeira fazia o import rejeitar o próprio
 * template com "Colunas não reconhecidas".
 */
const VALOR: XlsxColumnDefinition = {
  name: 'valor',
  required: true,
  type: 'number',
  description: 'Preço do produto, só números, sem pontos nem símbolo.',
  example: '450000',
};

const CURRENCY: XlsxColumnDefinition = {
  name: 'currency',
  required: true,
  type: 'string',
  description: 'Moeda do valor: BRL (real) ou USD (dólar).',
  example: 'BRL',
};

const IDENTIFICADOR: XlsxColumnDefinition = {
  name: 'identificador',
  required: false,
  type: 'string',
  description:
    'Código único do produto no seu catálogo. Reimportar o mesmo código atualiza o produto em vez de duplicar. Se ficar vazio, é gerado a partir dos dados da linha — nesse caso, mudar marca, modelo ou outro dado descritivo cria um produto novo. Preencha se for editar a linha depois.',
  example: 'BMW-X5-2023-01',
};

const FOLDER_URL: XlsxColumnDefinition = {
  name: 'folder_url',
  required: false,
  type: 'string',
  description:
    'Link de uma pasta pública do Google Drive com as fotos do produto.',
  example: 'https://drive.google.com/drive/folders/SEU_FOLDER_ID',
};

function common(
  productLabel: string,
  examples: { marca: string; modelo: string },
): XlsxColumnDefinition[] {
  return [
    IDENTIFICADOR,
    {
      name: 'marca',
      required: false,
      type: 'string',
      description: `Marca/fabricante. Se vazio, aparece como "${productLabel}".`,
      example: examples.marca,
    },
    {
      name: 'modelo',
      required: false,
      type: 'string',
      description:
        'Nome do modelo. Se vazio, aparece o identificador no lugar.',
      example: examples.modelo,
    },
    VALOR,
    CURRENCY,
    {
      name: 'estado',
      required: false,
      type: 'string',
      description:
        'Estado de conservação (ex.: novo, seminovo, usado). Se vazio, "não informado".',
      example: 'seminovo',
    },
    {
      name: 'ano',
      required: false,
      type: 'number',
      description: 'Ano de fabricação, 4 dígitos.',
      example: '2023',
    },
  ];
}

export const CAR_COLUMNS: XlsxColumnDefinition[] = [
  ...common('Carro', { marca: 'BMW', modelo: 'X5' }),
  { name: 'cor', required: false, type: 'string', description: 'Cor externa.', example: 'Preto' },
  { name: 'km', required: false, type: 'number', description: 'Quilometragem, só números.', example: '15000' },
  { name: 'cambio', required: false, type: 'string', description: 'Tipo de câmbio.', example: 'Automático' },
  { name: 'combustivel', required: false, type: 'string', description: 'Combustível.', example: 'Gasolina' },
  { name: 'tipo_categoria', required: false, type: 'string', description: 'Categoria do carro.', example: 'SUV' },
  { name: 'descricao', required: false, type: 'string', description: 'Texto livre exibido na página do produto.', example: 'Carro em excelente estado' },
  FOLDER_URL,
];

export const BOAT_COLUMNS: XlsxColumnDefinition[] = [
  ...common('Lancha', { marca: 'Azimut', modelo: 'Atlantis 51' }),
  { name: 'fabricante', required: false, type: 'string', description: 'Estaleiro/fabricante.', example: 'Azimut Yachts' },
  { name: 'tamanho', required: false, type: 'string', description: 'Comprimento da embarcação.', example: '51 pés' },
  { name: 'estilo', required: false, type: 'string', description: 'Estilo da embarcação.', example: 'Cabinada' },
  { name: 'combustivel', required: false, type: 'string', description: 'Combustível.', example: 'Diesel' },
  { name: 'motor', required: false, type: 'string', description: 'Motorização.', example: '2x Volvo IPS 600' },
  { name: 'ano_motor', required: false, type: 'number', description: 'Ano do motor, 4 dígitos.', example: '2022' },
  { name: 'tipo_embarcacao', required: false, type: 'string', description: 'Tipo de embarcação.', example: 'Lancha' },
  { name: 'descricao_completa', required: false, type: 'string', description: 'Texto livre exibido na página do produto.', example: 'Embarcação revisada' },
  { name: 'acessorios', required: false, type: 'string', description: 'Acessórios incluídos.', example: 'GPS, ar-condicionado' },
  FOLDER_URL,
];

export const AIRCRAFT_COLUMNS: XlsxColumnDefinition[] = [
  ...common('Aeronave', { marca: 'Embraer', modelo: 'Phenom 300' }),
  { name: 'categoria', required: false, type: 'string', description: 'Categoria da aeronave.', example: 'Jato executivo' },
  { name: 'assentos', required: false, type: 'number', description: 'Número de assentos, só números.', example: '8' },
  { name: 'tipo_aeronave', required: false, type: 'string', description: 'Tipo de aeronave.', example: 'Jato' },
  { name: 'descricao', required: false, type: 'string', description: 'Texto livre exibido na página do produto.', example: 'Aeronave com manutenção em dia' },
  FOLDER_URL,
];
