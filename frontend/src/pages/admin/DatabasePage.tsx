// Navegador read-only da base de dados (ADMIN): abas por tabela + paginação.
import { useEffect, useState } from "react";
import {
  Database,
  Loader,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
} from "lucide-react";
import {
  getEntities,
  getRecords,
  type EntityInfo,
  type RecordsPage,
} from "../../services/admin-database.service";
import { downloadCsv, openPrintablePdf } from "../../utils/export";
import Button from "../../components/ui/button";
import { Alert } from "../../components/ui/alert";
import { EmptyState } from "../../components/patterns/EmptyState";

const PAGE_SIZE = 20;

// Tradução dos nomes de coluna (campos do Prisma) para português — cobre os
// campos das 9 entidades navegáveis (ver ENTITIES em admin-database.service.ts
// no backend). Campo sem tradução mapeada cai no fallback (nome cru), nunca quebra.
const FIELD_LABELS: Record<string, string> = {
  // Genéricos
  id: "ID",
  name: "Nome",
  surname: "Sobrenome",
  email: "E-mail",
  role: "Papel",
  cpf: "CPF",
  rg: "RG",
  phone: "Telefone",
  speciality: "Especialidade",
  commission_rate: "Taxa de comissão",
  company_id: "ID da empresa",
  consultant_id: "ID do consultor",
  identification_number: "Número de identificação",
  created_at: "Criado em",
  updated_at: "Atualizado em",
  status: "Status",
  notes: "Observações",
  description: "Descrição",
  bank: "Banco",
  agency: "Agência",
  checking_account: "Conta corrente",
  is_active: "Ativo",
  deactivated_at: "Desativado em",
  deactivated_by: "Desativado por",
  deactivated_by_sync_job_id: "Desativado por (job de sincronização)",

  // Empresas (companies)
  cnpj: "CNPJ",
  logo: "Logo",
  platform_commission_rate: "Taxa de comissão da plataforma",
  color_identity: "Cores da identidade visual",

  // Produtos (cars/boats/aircrafts)
  specialist_id: "ID do especialista",
  marca: "Marca",
  modelo: "Modelo",
  valor: "Valor",
  estado: "Estado",
  ano: "Ano",
  descricao: "Descrição",
  cor: "Cor",
  km: "Quilometragem",
  cambio: "Câmbio",
  combustivel: "Combustível",
  tipo_categoria: "Categoria",
  fabricante: "Fabricante",
  tamanho: "Tamanho",
  estilo: "Estilo",
  motor: "Motor",
  ano_motor: "Ano do motor",
  descricao_completa: "Descrição completa",
  acessorios: "Acessórios",
  tipo_embarcacao: "Tipo de embarcação",
  categoria: "Categoria",
  assentos: "Assentos",
  tipo_aeronave: "Tipo de aeronave",

  // Processos (processes)
  client_id: "ID do cliente",
  car_id: "ID do carro",
  aircraft_id: "ID da aeronave",
  boat_id: "ID da embarcação",
  product_id: "ID do produto",
  product_type: "Tipo de produto",
  active_contract_id: "ID do contrato ativo",
  appointment_id: "ID do agendamento",
  accepted_proposal_id: "ID da proposta aceita",

  // Contratos (contracts)
  process_id: "ID do processo",
  provider_name: "Provedor",
  provider_id: "ID no provedor",
  provider_status: "Status no provedor",
  provider_meta: "Metadados do provedor",
  file_name: "Nome do arquivo",
  file_path: "Caminho do arquivo",
  file_type: "Tipo do arquivo",
  file_size: "Tamanho do arquivo",
  original_pdf_url: "URL do PDF original",
  seller_name: "Nome do vendedor",
  seller_cpf: "CPF do vendedor",
  seller_rg: "RG do vendedor",
  seller_address: "Endereço do vendedor",
  seller_cep: "CEP do vendedor",
  seller_bank: "Banco do vendedor",
  seller_agency: "Agência do vendedor",
  seller_checking_account: "Conta corrente do vendedor",
  buyer_name: "Nome do comprador",
  buyer_cpf: "CPF do comprador",
  buyer_rg: "RG do comprador",
  buyer_address: "Endereço do comprador",
  buyer_cep: "CEP do comprador",
  vehicle_model: "Modelo do veículo",
  vehicle_year: "Ano do veículo",
  vehicle_registration_id: "Identificação (placa/inscrição/prefixo)",
  vehicle_serial_number: "Número serial (chassi/casco/série)",
  vehicle_technical_information: "Informações técnicas",
  vehicle_price: "Preço do veículo",
  vehicle_price_written: "Preço por extenso",
  payment_seller_value: "Valor líquido do vendedor",
  payment_seller_value_written: "Valor líquido por extenso",
  platform_value: "Valor da plataforma",
  platform_value_written: "Valor da plataforma por extenso",
  platform_percentage: "Percentual da plataforma",
  platform_name: "Nome da plataforma",
  platform_cnpj: "CNPJ da plataforma",
  platform_bank: "Banco da plataforma",
  platform_agency: "Agência da plataforma",
  platform_checking_account: "Conta corrente da plataforma",
  office_value: "Valor do escritório",
  office_value_written: "Valor do escritório por extenso",
  office_name: "Nome do escritório",
  office_cnpj: "CNPJ do escritório",
  office_bank: "Banco do escritório",
  office_agency: "Agência do escritório",
  office_checking_account: "Conta corrente do escritório",
  specialist_commission_value: "Valor da comissão do especialista",
  specialist_commission_value_written:
    "Valor da comissão do especialista por extenso",
  specialist_commission_rate: "Taxa de comissão do especialista",
  specialist_name: "Nome do especialista",
  specialist_document: "CNPJ do especialista",
  specialist_bank: "Banco do especialista",
  specialist_agency: "Agência do especialista",
  specialist_checking_account: "Conta corrente do especialista",
  testimonial1_cpf: "CPF da testemunha 1",
  testimonial1_email: "E-mail da testemunha 1",
  testimonial2_cpf: "CPF da testemunha 2",
  testimonial2_email: "E-mail da testemunha 2",
  city: "Cidade",
  template_id: "ID do template",
  signed_pdf_url: "URL do PDF assinado",
  rejected_reason: "Motivo da recusa",
  signed_at: "Assinado em",
  signature_type: "Tipo de assinatura",
  uploaded_by_id: "Enviado por (ID)",
  uploaded_by_type: "Enviado por (papel)",
  signed_by_id: "Assinado por (ID)",

  // Propostas (proposals)
  proposed_by_id: "ID de quem propôs",
  proposed_to_id: "ID de quem recebeu",
  proposed_value: "Valor proposto",
  message: "Mensagem",
  counter_to_id: "ID da proposta anterior (contraproposta)",

  // Agendamentos (appointments)
  appointment_datetime: "Data e hora do agendamento",
  user_clicked_at: "Clicado em",
  pending_expires_at: "Expira em",
  confirmed_at: "Confirmado em",
  confirmed_by_id: "Confirmado por (ID)",
  calendly_event_uri: "URI do evento (Calendly)",
  calendly_invitee_uri: "URI do convidado (Calendly)",
  calendly_scheduled_at: "Agendado em (Calendly)",
  calendly_last_sync_at: "Última sincronização (Calendly)",
  calendly_sync_status: "Status de sincronização (Calendly)",
};

function translateColumn(key: string): string {
  return FIELD_LABELS[key] ?? key;
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  if (typeof value === "object") return JSON.stringify(value);
  const str = String(value);
  if (/^\d{4}-\d{2}-\d{2}T/.test(str)) {
    const d = new Date(str);
    if (!isNaN(d.getTime())) return d.toLocaleString("pt-BR");
  }
  return str;
}

export default function DatabasePage() {
  const [entities, setEntities] = useState<EntityInfo[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<RecordsPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getEntities()
      .then((list) => {
        setEntities(list);
        setActive(list[0]?.key ?? null);
      })
      .catch((err) =>
        setError((err as Error).message || "Erro ao carregar entidades."),
      );
  }, []);

  useEffect(() => {
    if (!active) return;
    setLoading(true);
    setError(null);
    getRecords(active, page, PAGE_SIZE)
      .then(setResult)
      .catch((err) =>
        setError((err as Error).message || "Erro ao carregar registros."),
      )
      .finally(() => setLoading(false));
  }, [active, page]);

  const rows = result?.data ?? [];
  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
  const totalPages = result
    ? Math.max(1, Math.ceil(result.total / result.pageSize))
    : 1;
  const activeLabel =
    entities.find((e) => e.key === active)?.label ?? active ?? "";
  const exportRows = () => rows.map((r) => columns.map((c) => formatCell(r[c])));

  return (
    <div className="text-text-main w-full min-w-0">
      <div className="flex items-center gap-3 mb-6">
        <Database className="w-7 h-7 text-ink-soft" />
        <div>
          <h1 className="text-h1 font-bold text-ink">Base de dados</h1>
          <p className="text-sm text-muted">
            Visão consolidada — navegue por todas as tabelas da plataforma.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-border mb-4">
        {entities.map((e) => (
          <button
            key={e.key}
            type="button"
            onClick={() => {
              setActive(e.key);
              setPage(1);
            }}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              active === e.key
                ? "border-ink text-ink"
                : "border-transparent text-muted hover:text-ink-soft"
            }`}
          >
            {e.label}
          </button>
        ))}
      </div>

      {error && (
        <Alert variant="danger" className="mb-4">
          {error}
        </Alert>
      )}

      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <Loader className="w-8 h-8 animate-spin text-subtle" />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState icon={Database} title="Nenhum registro." />
      ) : (
        <>
          <div className="flex justify-end gap-2 mb-3">
            <Button
              type="button"
              variant="light"
              onClick={() =>
                downloadCsv(
                  `${active}.csv`,
                  columns.map(translateColumn),
                  exportRows(),
                )
              }
            >
              <Download className="w-4 h-4" /> CSV
            </Button>
            <Button
              type="button"
              variant="light"
              onClick={() =>
                openPrintablePdf(
                  `Base de dados — ${activeLabel}`,
                  columns.map(translateColumn),
                  exportRows(),
                )
              }
            >
              <FileText className="w-4 h-4" /> PDF
            </Button>
          </div>

          <div className="overflow-auto border border-border rounded-lg max-h-[65vh] w-full max-w-full">
            <table className="min-w-full text-sm">
              <thead className="bg-border-soft sticky top-0 z-10">
                <tr>
                  {columns.map((c) => (
                    <th
                      key={c}
                      className="px-3 py-2 text-left font-medium text-muted whitespace-nowrap"
                    >
                      {translateColumn(c)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className="border-t border-border-soft">
                    {columns.map((c) => {
                      const text = formatCell(row[c]);
                      return (
                        <td
                          key={c}
                          className="px-3 py-2 whitespace-nowrap text-ink-soft max-w-[280px] truncate"
                          title={text}
                        >
                          {text}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between mt-3 text-sm text-muted">
            <span>{result?.total ?? 0} registros</span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="light"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="w-4 h-4" /> Anterior
              </Button>
              <span>
                Página {page} de {totalPages}
              </span>
              <Button
                type="button"
                variant="light"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Próxima <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
