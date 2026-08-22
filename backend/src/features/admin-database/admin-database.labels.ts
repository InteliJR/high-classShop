// Dicionários de tradução para exibição na base de dados do admin.
//
// ATENÇÃO: nem todo campo abaixo é enum no Prisma. Car.estado,
// Car.tipo_categoria, Boat.tipo_embarcacao, Aircraft.tipo_aeronave e
// Aircraft.categoria são String no schema — o valor gravado é a string do
// @map (minúscula), não o nome do membro. Por isso as chaves variam de caixa.
import { EMPTY } from './admin-database.format';

/** Constrói um formatador a partir de um dicionário. Chave desconhecida
 *  devolve o valor cru: dado legado não pode quebrar a página. */
export function enumLabel(
  dict: Record<string, string>,
): (v: unknown) => string {
  return (v: unknown) => {
    if (v === null || v === undefined || v === '') return EMPTY;
    const key = String(v);
    return dict[key] ?? key;
  };
}

// === Enums reais do Prisma (chave em MAIÚSCULA) ===

export const USER_ROLE: Record<string, string> = {
  CUSTOMER: 'Cliente',
  CONSULTANT: 'Consultor',
  SPECIALIST: 'Especialista',
  ADMIN: 'Administrador',
  OFFICE: 'Gerente de escritório',
};

export const PRODUCT_TYPE: Record<string, string> = {
  CAR: 'Carro',
  BOAT: 'Barco',
  AIRCRAFT: 'Aeronave',
};

export const PROCESS_STATUS: Record<string, string> = {
  SCHEDULING: 'Agendamento',
  NEGOTIATION: 'Em negociação',
  PROCESSING_CONTRACT: 'Contrato em processamento',
  DOCUMENTATION: 'Documentação',
  COMPLETED: 'Concluído',
  REJECTED: 'Recusado',
};

export const CONTRACT_STATUS: Record<string, string> = {
  PENDING: 'Pendente',
  REJECTED: 'Recusado',
  SIGNED: 'Assinado',
};

export const SIGNATURE_TYPE: Record<string, string> = {
  SIMPLE: 'Simples',
  ADVANCED: 'Avançada',
  QUALIFIED: 'Qualificada',
};

// === Campos String com valor do @map (chave em minúscula) ===

export const ESTADO_PRODUTO: Record<string, string> = {
  novo: 'Novo',
  seminovo: 'Seminovo',
  colecao: 'Coleção',
};

export const TIPO_CATEGORIA_CARRO: Record<string, string> = {
  SUV: 'SUV',
  sedan: 'Sedã',
  coupe: 'Cupê',
  conversivel: 'Conversível',
  esportivo: 'Esportivo',
  supercarro: 'Supercarro',
};

export const TIPO_EMBARCACAO: Record<string, string> = {
  iate: 'Iate',
  lancha: 'Lancha',
  catamara: 'Catamarã',
  veleiro: 'Veleiro',
  jet_boat: 'Jet boat',
  outro: 'Outro',
};

export const TIPO_AERONAVE: Record<string, string> = {
  VLJ: 'VLJ',
  executivo_medio: 'Executivo médio',
  intercontinental: 'Intercontinental',
  turbohelice: 'Turboélice',
  helicoptero: 'Helicóptero',
};
