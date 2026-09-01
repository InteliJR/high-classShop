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
  /**
   * Como interpretar a key devolvida por get().
   *
   * 'company-logo' (padrão) aplica a heurística de prefixo `companies/`:
   * logos legados, gravados em base64 sem path, viram célula vazia.
   *
   * 's3-key' assina a key direto. É o caso das imagens de produto, cujo
   * campo `image_url` guarda a key (o nome engana) e é assinado do mesmo
   * jeito nos endpoints públicos de catálogo.
   */
  imageSource?: 'company-logo' | 's3-key';
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

/** Colapsa car/boat/aircraft numa descrição única. A coluna Tipo já informa
 *  qual dos três era, então as 4 colunas de ID viram uma só. */
const produto = (r: any) => {
  const p = r.car ?? r.boat ?? r.aircraft;
  return p ? `${p.marca ?? ''} ${p.modelo ?? ''}`.trim() : undefined;
};

/** Projeção da imagem de capa de um produto.
 *
 * `orderBy` resolve a preferência no banco: is_primary desc traz a principal
 * primeiro e, quando nenhuma está marcada, created_at asc devolve a mais
 * antiga — a "primeira disponível". `take: 1` evita arrastar a galeria
 * inteira só para mostrar uma miniatura.
 *
 * Apesar do nome, `image_url` guarda a key do S3, e é assim que os endpoints
 * de catálogo a tratam.
 */
const imagemDeCapa = {
  select: { image_url: true },
  orderBy: [{ is_primary: 'desc' }, { created_at: 'asc' }],
  take: 1,
} as const;

/** Key da imagem de capa, ou undefined para o guarda de vazio. */
const capa = (r: any) => r.images?.[0]?.image_url ?? undefined;

/** Identifica um processo por gente e coisa, não por UUID:
 *  "João Silva — Ferrari F8 Tributo". Sem produto (consultoria), só o cliente. */
const processoLegivel = (p: any) => {
  if (!p) return undefined;
  const partes = [pessoa(p.client), produto(p)].filter(Boolean);
  return partes.length ? partes.join(' — ') : undefined;
};

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

  cars: {
    model: 'car',
    label: 'Carros',
    select: {
      marca: true, modelo: true, ano: true, valor: true, estado: true,
      tipo_categoria: true, cor: true, km: true, cambio: true,
      combustivel: true, identificador: true, is_active: true, created_at: true,
      specialist: { select: { name: true, surname: true } },
      images: imagemDeCapa,
    },
    columns: [
      {
        label: 'Imagem',
        get: capa,
        image: true,
        imageSource: 's3-key',
        alt: (r) => `Foto de ${[r.marca, r.modelo].filter(Boolean).join(' ') || 'produto'}`,
      },
      { label: 'Marca', get: (r) => r.marca },
      { label: 'Modelo', get: (r) => r.modelo },
      { label: 'Ano', get: (r) => r.ano },
      { label: 'Valor', get: (r) => r.valor, format: f.money },
      { label: 'Estado', get: (r) => r.estado, format: enumLabel(ESTADO_PRODUTO) },
      { label: 'Categoria', get: (r) => r.tipo_categoria, format: enumLabel(TIPO_CATEGORIA_CARRO) },
      { label: 'Cor', get: (r) => r.cor },
      { label: 'Quilometragem', get: (r) => r.km, format: f.int },
      { label: 'Câmbio', get: (r) => r.cambio },
      { label: 'Combustível', get: (r) => r.combustivel },
      { label: 'Identificador', get: (r) => r.identificador },
      { label: 'Especialista', get: (r) => pessoa(r.specialist) },
      { label: 'Ativo', get: (r) => r.is_active, format: f.bool },
      { label: 'Criado em', get: (r) => r.created_at, format: f.date },
    ],
  },

  boats: {
    model: 'boat',
    label: 'Barcos',
    select: {
      marca: true, modelo: true, ano: true, valor: true, estado: true,
      tipo_embarcacao: true, fabricante: true, tamanho: true, estilo: true,
      motor: true, ano_motor: true, combustivel: true, identificador: true,
      is_active: true, created_at: true,
      specialist: { select: { name: true, surname: true } },
      images: imagemDeCapa,
    },
    columns: [
      {
        label: 'Imagem',
        get: capa,
        image: true,
        imageSource: 's3-key',
        alt: (r) => `Foto de ${[r.marca, r.modelo].filter(Boolean).join(' ') || 'produto'}`,
      },
      { label: 'Marca', get: (r) => r.marca },
      { label: 'Modelo', get: (r) => r.modelo },
      { label: 'Ano', get: (r) => r.ano },
      { label: 'Valor', get: (r) => r.valor, format: f.money },
      { label: 'Estado', get: (r) => r.estado, format: enumLabel(ESTADO_PRODUTO) },
      { label: 'Tipo de embarcação', get: (r) => r.tipo_embarcacao, format: enumLabel(TIPO_EMBARCACAO) },
      { label: 'Fabricante', get: (r) => r.fabricante },
      { label: 'Tamanho', get: (r) => r.tamanho },
      { label: 'Estilo', get: (r) => r.estilo },
      { label: 'Motor', get: (r) => r.motor },
      { label: 'Ano do motor', get: (r) => r.ano_motor },
      { label: 'Combustível', get: (r) => r.combustivel },
      { label: 'Identificador', get: (r) => r.identificador },
      { label: 'Especialista', get: (r) => pessoa(r.specialist) },
      { label: 'Ativo', get: (r) => r.is_active, format: f.bool },
      { label: 'Criado em', get: (r) => r.created_at, format: f.date },
    ],
  },

  aircrafts: {
    model: 'aircraft',
    label: 'Aeronaves',
    select: {
      marca: true, modelo: true, ano: true, valor: true, estado: true,
      tipo_aeronave: true, categoria: true, assentos: true,
      identificador: true, is_active: true, created_at: true,
      specialist: { select: { name: true, surname: true } },
      images: imagemDeCapa,
    },
    columns: [
      {
        label: 'Imagem',
        get: capa,
        image: true,
        imageSource: 's3-key',
        alt: (r) => `Foto de ${[r.marca, r.modelo].filter(Boolean).join(' ') || 'produto'}`,
      },
      { label: 'Marca', get: (r) => r.marca },
      { label: 'Modelo', get: (r) => r.modelo },
      { label: 'Ano', get: (r) => r.ano },
      { label: 'Valor', get: (r) => r.valor, format: f.money },
      { label: 'Estado', get: (r) => r.estado, format: enumLabel(ESTADO_PRODUTO) },
      { label: 'Tipo de aeronave', get: (r) => r.tipo_aeronave, format: enumLabel(TIPO_AERONAVE) },
      { label: 'Categoria', get: (r) => r.categoria },
      { label: 'Assentos', get: (r) => r.assentos },
      { label: 'Identificador', get: (r) => r.identificador },
      { label: 'Especialista', get: (r) => pessoa(r.specialist) },
      { label: 'Ativo', get: (r) => r.is_active, format: f.bool },
      { label: 'Criado em', get: (r) => r.created_at, format: f.date },
    ],
  },
  processes: {
    model: 'process',
    label: 'Processos',
    select: {
      id: true, product_type: true, status: true, notes: true,
      active_contract_id: true, created_at: true,
      client: { select: { name: true, surname: true } },
      specialist: { select: { name: true, surname: true } },
      car: { select: { marca: true, modelo: true } },
      boat: { select: { marca: true, modelo: true } },
      aircraft: { select: { marca: true, modelo: true } },
      appointment: { select: { appointment_datetime: true } },
      accepted_proposal: { select: { proposed_value: true } },
    },
    columns: [
      { label: 'ID', get: (r) => idCurto(r.id) },
      { label: 'Cliente', get: (r) => pessoa(r.client) },
      { label: 'Especialista', get: (r) => pessoa(r.specialist) },
      { label: 'Produto', get: produto },
      { label: 'Tipo', get: (r) => r.product_type, format: enumLabel(PRODUCT_TYPE) },
      { label: 'Status', get: (r) => r.status, format: enumLabel(PROCESS_STATUS) },
      { label: 'Agendamento', get: (r) => r.appointment?.appointment_datetime, format: f.datetime },
      { label: 'Valor aceito', get: (r) => r.accepted_proposal?.proposed_value, format: f.money },
      // Booleano em vez do UUID: o admin só quer saber se existe contrato.
      { label: 'Contrato', get: (r) => r.active_contract_id != null, format: f.bool },
      { label: 'Observações', get: (r) => r.notes, wide: true },
      { label: 'Criado em', get: (r) => r.created_at, format: f.date },
    ],
  },
  contracts: {
    model: 'contract',
    label: 'Contratos',
    // Projeção enxuta de propósito: bancários das 4 partes, valores por
    // extenso, provider_meta, arquivos e testemunhas são dados de geração de
    // documento, não de consulta tabular.
    select: {
      id: true, buyer_name: true, buyer_cpf: true, seller_name: true,
      vehicle_model: true, vehicle_year: true, vehicle_price: true,
      payment_seller_value: true, specialist_commission_value: true,
      office_value: true, platform_value: true,
      status: true, signature_type: true, signed_at: true,
      process: {
        select: {
          client: { select: { name: true, surname: true } },
          car: { select: { marca: true, modelo: true } },
          boat: { select: { marca: true, modelo: true } },
          aircraft: { select: { marca: true, modelo: true } },
        },
      },
    },
    columns: [
      { label: 'ID', get: (r) => idCurto(r.id) },
      { label: 'Processo', get: (r) => processoLegivel(r.process) },
      { label: 'Comprador', get: (r) => r.buyer_name },
      { label: 'CPF do comprador', get: (r) => r.buyer_cpf, format: f.cpf },
      { label: 'Vendedor', get: (r) => r.seller_name },
      {
        label: 'Veículo',
        get: (r) => [r.vehicle_model, r.vehicle_year].filter(Boolean).join(' ') || undefined,
      },
      { label: 'Valor', get: (r) => r.vehicle_price, format: f.money },
      { label: 'Valor ao vendedor', get: (r) => r.payment_seller_value, format: f.money },
      { label: 'Comissão especialista', get: (r) => r.specialist_commission_value, format: f.money },
      { label: 'Escritório', get: (r) => r.office_value, format: f.money },
      { label: 'Plataforma', get: (r) => r.platform_value, format: f.money },
      { label: 'Status', get: (r) => r.status, format: enumLabel(CONTRACT_STATUS) },
      { label: 'Assinatura', get: (r) => r.signature_type, format: enumLabel(SIGNATURE_TYPE) },
      { label: 'Assinado em', get: (r) => r.signed_at, format: f.datetime },
    ],
  },
};
