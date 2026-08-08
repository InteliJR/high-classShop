// Config de colunas curadas por entidade. É o ponto de verdade único do
// navegador de base de dados: tela, CSV e PDF consomem a mesma projeção.
//
// Só as entidades listadas aqui são navegáveis. Tabelas com segredo
// (CalendlyConnection, CustomerAdvisor.token, RefreshToken) ficam de fora de
// propósito. Propostas e Agendamentos saíram porque só mostravam UUID e enum
// cru — a informação útil de ambas vive hoje nas colunas Agendamento e Valor
// aceito da aba Processos.
import * as f from './admin-database.format';
import {
  CONTRACT_STATUS,
  ESTADO_PRODUTO,
  PROCESS_STATUS,
  PRODUCT_TYPE,
  SIGNATURE_TYPE,
  TIPO_AERONAVE,
  TIPO_CATEGORIA_CARRO,
  TIPO_EMBARCACAO,
  USER_ROLE,
  enumLabel,
} from './admin-database.labels';

/** Célula pronta para exibir. Texto, salvo a exceção da imagem (logo). */
export type Cell =
  | string
  | { kind: 'image'; url: string | null; alt: string };

/** Metadado da coluna enviado ao frontend junto das linhas. */
export type ColumnMeta = { label: string; wide?: boolean };

export type Column = {
  label: string;
  /** Extrai o valor cru da linha (scalar ou relação aninhada). */
  get: (row: any) => unknown;
  /** Formatador da Task 1/2. Omitido = String(v) com guarda de vazio. */
  format?: (v: unknown) => string;
  /** Célula multilinha, para texto livre longo (Observações). */
  wide?: boolean;
  /** get() devolve uma key do S3 que vira URL assinada. */
  image?: true;
  /** Texto alternativo da imagem. Obrigatório quando image. */
  alt?: (row: any) => string;
};

export type EntityConfig = {
  /** Nome do delegate no PrismaService (ex: 'user'). */
  model: string;
  label: string;
  /** Projeção Prisma. Relações vêm aninhadas — mantém password_hash fora
   *  da query, não só fora da resposta. */
  select: Record<string, unknown>;
  columns: Column[];
};

/** Junta nome e sobrenome de uma relação de usuário; null vira undefined
 *  para o guarda de vazio devolver o travessão. */
const pessoa = (u: { name?: string; surname?: string } | null | undefined) =>
  u ? `${u.name ?? ''} ${u.surname ?? ''}`.trim() : undefined;

/** ID curto para referência humana (suporte, conferência). */
const idCurto = (id: unknown) => (id ? `#${String(id).slice(0, 8)}` : undefined);

export const ENTITIES: Record<string, EntityConfig> = {
  users: {
    model: 'user',
    label: 'Usuários',
    select: {
      name: true, surname: true, email: true, role: true, cpf: true, rg: true,
      phone: true, speciality: true, commission_rate: true,
      identification_number: true, is_active: true,
      company: { select: { name: true } },
      consultant: { select: { name: true, surname: true } },
    },
    columns: [
      { label: 'Nome', get: (r) => pessoa(r) },
      { label: 'E-mail', get: (r) => r.email },
      { label: 'Papel', get: (r) => r.role, format: enumLabel(USER_ROLE) },
      { label: 'CPF/CNPJ', get: (r) => r.cpf, format: f.document },
      { label: 'RG', get: (r) => r.rg },
      { label: 'Telefone', get: (r) => r.phone, format: f.phone },
      { label: 'Especialidade', get: (r) => r.speciality, format: enumLabel(PRODUCT_TYPE) },
      { label: 'Taxa de comissão', get: (r) => r.commission_rate, format: f.rate },
      { label: 'Escritório', get: (r) => r.company?.name },
      { label: 'Consultor', get: (r) => pessoa(r.consultant) },
      { label: 'Nº de identificação', get: (r) => r.identification_number },
      { label: 'Ativo', get: (r) => r.is_active, format: f.bool },
    ],
  },

  companies: {
    model: 'company',
    label: 'Escritórios',
    select: {
      name: true, cnpj: true, logo: true, slug: true, description: true,
      commission_rate: true, platform_commission_rate: true,
      bank: true, agency: true, checking_account: true,
      color_identity: true, created_at: true,
    },
    columns: [
      { label: 'Logo', get: (r) => r.logo, image: true, alt: (r) => `Logo ${r.name}` },
      { label: 'Nome', get: (r) => r.name },
      { label: 'CNPJ', get: (r) => r.cnpj, format: f.cnpj },
      { label: 'Slug', get: (r) => r.slug },
      { label: 'Descrição', get: (r) => r.description, wide: true },
      { label: 'Taxa de comissão', get: (r) => r.commission_rate, format: f.rate },
      { label: 'Taxa da plataforma', get: (r) => r.platform_commission_rate, format: f.rate },
      { label: 'Banco', get: (r) => r.bank },
      { label: 'Agência', get: (r) => r.agency },
      { label: 'Conta corrente', get: (r) => r.checking_account },
      { label: 'Cores', get: (r) => r.color_identity, format: f.hexList },
      { label: 'Criado em', get: (r) => r.created_at, format: f.date },
    ],
  },

  // Stubs — precisam existir na whitelist (contrato de countAll/list já
  // testado nesta task), mas as colunas de negócio reais entram nas
  // próximas tasks. Só o ID curto por enquanto.
  cars: {
    model: 'car',
    label: 'Carros',
    select: { id: true },
    columns: [{ label: 'ID', get: (r) => idCurto(r.id) }],
  },
  boats: {
    model: 'boat',
    label: 'Barcos',
    select: { id: true },
    columns: [{ label: 'ID', get: (r) => idCurto(r.id) }],
  },
  aircrafts: {
    model: 'aircraft',
    label: 'Aeronaves',
    select: { id: true },
    columns: [{ label: 'ID', get: (r) => idCurto(r.id) }],
  },
  processes: {
    model: 'process',
    label: 'Processos',
    select: { id: true },
    columns: [{ label: 'ID', get: (r) => idCurto(r.id) }],
  },
  contracts: {
    model: 'contract',
    label: 'Contratos',
    select: { id: true },
    columns: [{ label: 'ID', get: (r) => idCurto(r.id) }],
  },
};

// Configs completos de cars/boats/aircrafts entram na Task 4.
// Config completo de processes entra na Task 5.
// Config completo de contracts entra na Task 6.

// Evita "declarado mas não usado" enquanto as tasks 4-6 não chegaram.
void [CONTRACT_STATUS, ESTADO_PRODUTO, PROCESS_STATUS, SIGNATURE_TYPE,
  TIPO_AERONAVE, TIPO_CATEGORIA_CARRO, TIPO_EMBARCACAO];
