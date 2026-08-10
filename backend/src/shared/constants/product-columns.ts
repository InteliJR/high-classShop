import { XlsxColumnDefinition } from 'src/shared/services/xlsx-import.service';

/**
 * Fonte única das colunas de importação de produto.
 *
 * A ordem aqui define o header do CSV/XLSX baixado pelo usuário e a ordem da
 * aba "Instruções" — `identificador` vem primeiro por ser a chave do upsert.
 * O parser casa por nome, então planilhas em outra ordem continuam válidas.
 *
 * Antes existiam três cópias destas listas (um par por tipo de produto, em
 * `{cars,boats,aircrafts}.service.ts` e em `product-import-jobs.service.ts`).
 * O template era gerado de uma cópia e o import validado contra a outra, então
 * adicionar uma coluna só na primeira fazia o import rejeitar o próprio
 * template com "Colunas não reconhecidas".
 */
export const CAR_COLUMNS: XlsxColumnDefinition[] = [
  { name: 'identificador', required: true, type: 'string' },
  { name: 'marca', required: true, type: 'string' },
  { name: 'modelo', required: true, type: 'string' },
  { name: 'valor', required: true, type: 'number' },
  { name: 'estado', required: true, type: 'string' },
  { name: 'ano', required: true, type: 'number' },
  { name: 'cor', required: false, type: 'string' },
  { name: 'km', required: false, type: 'number' },
  { name: 'cambio', required: false, type: 'string' },
  { name: 'combustivel', required: false, type: 'string' },
  { name: 'tipo_categoria', required: false, type: 'string' },
  { name: 'descricao', required: false, type: 'string' },
  { name: 'folder_url', required: false, type: 'string' },
];

export const BOAT_COLUMNS: XlsxColumnDefinition[] = [
  { name: 'identificador', required: true, type: 'string' },
  { name: 'marca', required: true, type: 'string' },
  { name: 'modelo', required: true, type: 'string' },
  { name: 'valor', required: true, type: 'number' },
  { name: 'estado', required: true, type: 'string' },
  { name: 'ano', required: true, type: 'number' },
  { name: 'fabricante', required: false, type: 'string' },
  { name: 'tamanho', required: false, type: 'string' },
  { name: 'estilo', required: false, type: 'string' },
  { name: 'combustivel', required: false, type: 'string' },
  { name: 'motor', required: false, type: 'string' },
  { name: 'ano_motor', required: false, type: 'number' },
  { name: 'tipo_embarcacao', required: false, type: 'string' },
  { name: 'descricao_completa', required: false, type: 'string' },
  { name: 'acessorios', required: false, type: 'string' },
  { name: 'folder_url', required: false, type: 'string' },
];

export const AIRCRAFT_COLUMNS: XlsxColumnDefinition[] = [
  { name: 'identificador', required: true, type: 'string' },
  { name: 'marca', required: true, type: 'string' },
  { name: 'modelo', required: true, type: 'string' },
  { name: 'valor', required: true, type: 'number' },
  { name: 'estado', required: true, type: 'string' },
  { name: 'ano', required: true, type: 'number' },
  { name: 'categoria', required: false, type: 'string' },
  { name: 'assentos', required: false, type: 'number' },
  { name: 'tipo_aeronave', required: false, type: 'string' },
  { name: 'descricao', required: false, type: 'string' },
  { name: 'folder_url', required: false, type: 'string' },
];
