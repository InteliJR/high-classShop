// Página de gestão de escritórios, com listagem, criação, exclusão e visualização de consultores.

import { useEffect, useState, useContext, useCallback } from "react";
import {
  getCompanies,
  deleteCompany,
  getCompanyConsultants,
  inviteConsultant,
  type Company,
  type CompanyConsultant,
} from "../../services/companies.service";
import { adminInviteOffice, officeService, type OfficeClient } from "../../services/office";
import type { PaginationMeta } from "../../types/types";
import Button from "../../components/ui/button";
import { Alert } from "../../components/ui/alert";
import { Dialog, DialogContent } from "../../components/ui/dialog";
import { PageHeader } from "../../components/patterns/PageHeader";
import NewCompanyForm from "./NewCompanyForm";
import { AppContext } from "../../contexts/AppContext";
import { resolveCompanyLogo } from "../../utils/branding";
import { applyCnpjMask } from "../../utils/mask";
import {
  ChevronDown,
  ChevronUp,
  Users,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Link,
  Copy,
  Check,
  Pencil,
  Trash2,
} from "lucide-react";

// Estado de um painel de consultores expandido por empresa
interface ExpandedCompanyState {
  consultants: CompanyConsultant[];
  pagination: PaginationMeta;
  loading: boolean;
  error: string | null;
}

// Estado do painel de clientes (aba "Clientes" dentro do painel expandido)
interface ExpandedClientsState {
  clients: OfficeClient[];
  loading: boolean;
  error: string | null;
}

type CompanyPanelTab = "consultants" | "clients";

type InviteRole = "CONSULTANT" | "OFFICE";

interface InviteState {
  role: InviteRole;
  companyId: string;
  companyName: string;
  email: string;
  isLoading: boolean;
  inviteLink: string | null;
  error: string | null;
  copied: boolean;
}

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isNewCompanyModalOpen, setIsNewCompanyModalOpen] = useState(false);
  const [companyToEdit, setCompanyToEdit] = useState<Company | null>(null);
  const [companyToDelete, setCompanyToDelete] = useState<Company | null>(null);

  // Mapa de empresas expandidas: companyId -> estado dos consultores
  const [expandedCompanies, setExpandedCompanies] = useState<Record<string, ExpandedCompanyState>>({});
  // Mapa de empresas expandidas: companyId -> estado dos clientes (aba "Clientes")
  const [expandedClients, setExpandedClients] = useState<Record<string, ExpandedClientsState>>({});
  // Mapa de empresas expandidas: companyId -> aba ativa no painel
  const [panelTab, setPanelTab] = useState<Record<string, CompanyPanelTab>>({});

  // Estado do modal de convite de consultor
  const [inviteState, setInviteState] = useState<InviteState | null>(null);

  // Id da empresa cujo link whitelabel acabou de ser copiado (feedback visual transiente)
  const [copiedSlugId, setCopiedSlugId] = useState<string | null>(null);

  // Usa o contexto de busca global
  const { searchTerm } = useContext(AppContext);

  // Filtra as empresas com base no termo de busca
  const filteredCompanies = companies.filter((company) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      company.name.toLowerCase().includes(searchLower) ||
      company.cnpj.toLowerCase().includes(searchLower)
    );
  });

  // Busca os dados mais recentes da API e atualiza o estado da página.
  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      const companiesData = await getCompanies();
      setCompanies(companiesData);
      setError(null);
    } catch (err) {
      setError("Não foi possível carregar os escritórios.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Busca consultores de uma empresa (lazy loading)
  const loadConsultants = useCallback(
    async (companyId: string, page: number = 1) => {
      setExpandedCompanies((prev) => ({
        ...prev,
        [companyId]: {
          ...prev[companyId],
          loading: true,
          error: null,
          consultants: prev[companyId]?.consultants ?? [],
          pagination: prev[companyId]?.pagination ?? {
            current_page: 1,
            per_page: 5,
            total: 0,
            total_pages: 0,
            has_next: false,
            has_prev: false,
          },
        },
      }));

      try {
        const result = await getCompanyConsultants(companyId, page, 5);
        setExpandedCompanies((prev) => ({
          ...prev,
          [companyId]: {
            consultants: result.data,
            pagination: result.pagination,
            loading: false,
            error: null,
          },
        }));
      } catch {
        setExpandedCompanies((prev) => ({
          ...prev,
          [companyId]: {
            ...prev[companyId],
            loading: false,
            error: "Erro ao carregar consultores.",
          },
        }));
      }
    },
    [],
  );

  // Busca clientes ligados aos consultores de uma empresa (lazy loading)
  const loadClients = useCallback(async (companyId: string) => {
    setExpandedClients((prev) => ({
      ...prev,
      [companyId]: { clients: [], loading: true, error: null },
    }));
    try {
      const clients = await officeService.listClients({ companyId });
      setExpandedClients((prev) => ({
        ...prev,
        [companyId]: { clients, loading: false, error: null },
      }));
    } catch {
      setExpandedClients((prev) => ({
        ...prev,
        [companyId]: { clients: [], loading: false, error: "Erro ao carregar clientes." },
      }));
    }
  }, []);

  // Troca a aba do painel expandido (Consultores/Clientes), carregando dados sob demanda
  const switchPanelTab = useCallback(
    (companyId: string, tab: CompanyPanelTab) => {
      setPanelTab((prev) => ({ ...prev, [companyId]: tab }));
      if (tab === "clients" && !expandedClients[companyId]) {
        loadClients(companyId);
      }
    },
    [expandedClients, loadClients],
  );

  // Toggle expandir/colapsar empresa
  const toggleExpand = useCallback(
    (companyId: string) => {
      if (expandedCompanies[companyId]) {
        setExpandedCompanies((prev) => {
          const next = { ...prev };
          delete next[companyId];
          return next;
        });
        // Limpa o cache de clientes/aba também — reabrir sempre refaz o fetch,
        // evitando mostrar dados desatualizados (ex: cliente reatribuído a
        // outro consultor enquanto o painel estava fechado).
        setExpandedClients((prev) => {
          const next = { ...prev };
          delete next[companyId];
          return next;
        });
        setPanelTab((prev) => {
          const next = { ...prev };
          delete next[companyId];
          return next;
        });
      } else {
        loadConsultants(companyId, 1);
      }
    },
    [expandedCompanies, loadConsultants],
  );

  const openInviteModal = useCallback((company: Company, role: InviteRole = "CONSULTANT") => {
    setInviteState({
      role,
      companyId: company.id,
      companyName: company.name,
      email: "",
      isLoading: false,
      inviteLink: null,
      error: null,
      copied: false,
    });
  }, []);

  const handleSendInvite = useCallback(async () => {
    if (!inviteState) return;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const trimmedEmail = inviteState.email.trim();
    if (!emailRegex.test(trimmedEmail)) {
      setInviteState((prev) => prev ? { ...prev, error: "Informe um e-mail válido." } : null);
      return;
    }
    setInviteState((prev) => prev ? { ...prev, isLoading: true, error: null } : null);
    try {
      const result = inviteState.role === "OFFICE"
        ? await adminInviteOffice(inviteState.companyId, trimmedEmail.toLowerCase())
        : await inviteConsultant(inviteState.companyId, trimmedEmail);
      setInviteState((prev) => prev ? { ...prev, isLoading: false, inviteLink: result.inviteLink } : null);
    } catch (err) {
      const e = err as {
        friendlyMessage?: string;
        response?: { data?: { message?: string } };
        message?: string;
      };
      const message = e.friendlyMessage || e.response?.data?.message || e.message || "Erro ao gerar convite.";
      setInviteState((prev) => prev ? { ...prev, isLoading: false, error: message } : null);
    }
  }, [inviteState]);

  const handleCopyLink = useCallback(() => {
    if (!inviteState?.inviteLink) return;
    navigator.clipboard.writeText(inviteState.inviteLink).then(() => {
      setInviteState((prev) => prev ? { ...prev, copied: true } : null);
      setTimeout(() => setInviteState((prev) => prev ? { ...prev, copied: false } : null), 2000);
    });
  }, [inviteState]);

  const handleCopySlugLink = useCallback((company: Company) => {
    if (!company.slug) return;
    const url = `${window.location.origin}/i/${company.slug}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedSlugId(company.id);
      setTimeout(() => setCopiedSlugId((prev) => (prev === company.id ? null : prev)), 2000);
    });
  }, []);

  // Função chamada quando o formulário de novo/edição de escritório é submetido com sucesso.
  const handleFormSuccess = () => {
    setIsNewCompanyModalOpen(false);
    setCompanyToEdit(null);
    fetchData();
  };

  // Função chamada pelo modal de confirmação para apagar uma empresa.
  const handleConfirmDelete = async () => {
    if (!companyToDelete) return;
    try {
      await deleteCompany(companyToDelete.id);
      fetchData();
    } catch (err) {
      const errorMessage =
        (err as Error).message ||
        "Erro ao apagar o escritório. Tente novamente.";
      alert(errorMessage);
    } finally {
      setCompanyToDelete(null);
    }
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Exibe uma mensagem de 'loading' enquanto os dados não chegam.
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-3 border-border-soft border-t-primary rounded-full animate-spin" />
          <p className="text-muted">Carregando empresas...</p>
        </div>
      </div>
    );
  }

  // Exibe uma mensagem de erro se a busca de dados falhar.
  if (error) {
    return <Alert variant="danger">{error}</Alert>;
  }


  return (
    <div className="text-text-main w-full">
      {/* --- CABEÇALHO DA PÁGINA --- */}
      <PageHeader
        title="Gestão de Escritórios"
        actions={
          <Button type="button" onClick={() => setIsNewCompanyModalOpen(true)}>
            + Novo Escritório
          </Button>
        }
      />

      {/* --- TABELA DE ESCRITÓRIOS --- */}
      <div className="p-6 rounded-lg shadow bg-brand-container bg-bg-container overflow-x-auto">
        <h2 className="text-h2 font-semibold text-ink">Escritórios</h2>
        <p className="text-base mb-8 mt-2">
          Lista completa de empresas parceiras
        </p>

        {/* Cabeçalho da Lista */}
        <div className="hidden md:grid grid-cols-[2fr_1fr_1fr_auto] gap-5 px-4 py-2 text-base font-normal text-left text-text-secondary">
          <div>Empresa</div>
          <div>Escritório (% restante)</div>
          <div>Consultores</div>
          <div className="text-right">Ações</div>
        </div>

        {/* Corpo da Lista */}
        <div className="mt-4 flex flex-col gap-4 max-h-[70vh] overflow-y-auto p-2">
          {filteredCompanies.length === 0 ? (
            <p className="text-center text-muted py-8">
              {searchTerm
                ? "Nenhuma empresa encontrada com esse termo de busca."
                : "Nenhuma empresa cadastrada."}
            </p>
          ) : (
            filteredCompanies.map((company) => {
              const isExpanded = !!expandedCompanies[company.id];
              const expandedState = expandedCompanies[company.id];
              const activeTab = panelTab[company.id] ?? "consultants";
              const clientsState = expandedClients[company.id];

              return (
                <div
                  key={company.id}
                  className="rounded-lg shadow-sm bg-surface overflow-hidden"
                >
                  {/* Linha principal da empresa */}
                  <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_auto] gap-3 md:gap-5 items-start md:items-center bg-brand-card p-4 md:p-6">
                    <div className="flex items-center gap-3">
                      {/* Botão expand/collapse */}
                      <button
                        onClick={() => toggleExpand(company.id)}
                        className="p-1 rounded hover:bg-border-soft transition-colors"
                        title={
                          isExpanded
                            ? "Recolher consultores"
                            : "Ver consultores"
                        }
                      >
                        {isExpanded ? (
                          <ChevronUp className="w-5 h-5 text-muted" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-muted" />
                        )}
                      </button>
                      {(() => {
                        const logoSrc = resolveCompanyLogo(company);
                        return logoSrc ? (
                          <img
                            src={logoSrc}
                            alt={company.name}
                            className="h-8 w-24 object-contain"
                          />
                        ) : (
                          <div className="h-8 w-24 flex items-center justify-center bg-border-soft rounded text-xs text-muted">
                            Sem Logo
                          </div>
                        );
                      })()}
                      <div>
                        <span className="font-medium">{company.name}</span>
                        <span className="block text-xs text-subtle">
                          {applyCnpjMask(company.cnpj)}
                        </span>
                      </div>
                    </div>

                    {/* % Escritório (fatia do restante) */}
                    <div>
                      {company.commission_rate != null ? (
                        <span className="inline-flex items-center gap-1 text-sm font-medium text-status-ok bg-status-ok-wash px-2.5 py-1 rounded-full">
                          {company.commission_rate}%
                        </span>
                      ) : (
                        <span className="text-subtle text-sm">
                          Não definida
                        </span>
                      )}
                    </div>

                    {/* Consultores count */}
                    <div>
                      <button
                        onClick={() => toggleExpand(company.id)}
                        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink transition-colors"
                      >
                        <Users className="w-4 h-4" />
                        <span className="font-medium">
                          {company.consultants_count ?? 0}
                        </span>
                      </button>
                    </div>

                    {/* Ações */}
                    <div className="flex justify-end items-center gap-4 text-subtle">
                      <button
                        title={
                          company.slug
                            ? "Copiar link do site whitelabel"
                            : "Escritório sem site whitelabel configurado"
                        }
                        onClick={() => handleCopySlugLink(company)}
                        disabled={!company.slug}
                        className="p-1.5 rounded hover:bg-border-soft text-ink-soft disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        {copiedSlugId === company.id ? (
                          <Check className="w-4 h-4 text-status-ok" />
                        ) : (
                          <Link className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        title="Convidar gerente do escritório (OFFICE)"
                        onClick={() => openInviteModal(company, "OFFICE")}
                        className="text-xs font-medium bg-action text-white px-2 py-1 rounded hover:bg-ink"
                      >
                        + Gerente
                      </button>
                      <button
                        onClick={() => setCompanyToEdit(company)}
                        className="p-1.5 rounded hover:bg-border-soft text-ink-soft"
                        title="Editar"
                      >
                        <Pencil size={18} />
                      </button>
                      <button
                        onClick={() => setCompanyToDelete(company)}
                        className="p-1.5 rounded hover:bg-status-bad-wash text-status-bad"
                        title="Deletar"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>

                  {/* Painel expandido: consultores / clientes */}
                  {isExpanded && (
                    <div className="border-t border-border-soft bg-border-soft px-6 py-4">
                      {/* Header do painel: abas + botão convidar */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-4">
                          <button
                            onClick={() => switchPanelTab(company.id, "consultants")}
                            className={`text-xs font-semibold uppercase tracking-wider pb-1 border-b-2 -mb-px ${
                              activeTab === "consultants"
                                ? "border-ink text-ink"
                                : "border-transparent text-muted hover:text-ink-soft"
                            }`}
                          >
                            Consultores
                          </button>
                          <button
                            onClick={() => switchPanelTab(company.id, "clients")}
                            className={`text-xs font-semibold uppercase tracking-wider pb-1 border-b-2 -mb-px ${
                              activeTab === "clients"
                                ? "border-ink text-ink"
                                : "border-transparent text-muted hover:text-ink-soft"
                            }`}
                          >
                            Clientes
                          </button>
                        </div>
                        {activeTab === "consultants" && (
                          <button
                            onClick={() => openInviteModal(company)}
                            className="inline-flex items-center gap-1.5 text-xs font-medium bg-action text-white px-3 py-1.5 rounded hover:bg-ink transition-colors"
                          >
                            <Link className="w-3.5 h-3.5" />
                            Convidar Consultor
                          </button>
                        )}
                      </div>

                      {activeTab === "clients" ? (
                        clientsState?.loading ? (
                          <div className="flex items-center justify-center py-6 gap-2 text-muted">
                            <Loader2 className="w-5 h-5 animate-spin" />
                            <span className="text-sm">Carregando clientes...</span>
                          </div>
                        ) : clientsState?.error ? (
                          <p className="text-sm text-status-bad py-4 text-center">
                            {clientsState.error}
                          </p>
                        ) : !clientsState || clientsState.clients.length === 0 ? (
                          <p className="text-sm text-muted py-4 text-center">
                            Nenhum cliente ligado a consultores deste escritório.
                          </p>
                        ) : (
                          <>
                            <div className="grid grid-cols-[2fr_2fr_2fr_1fr] gap-4 px-3 py-2 text-xs font-semibold text-muted uppercase tracking-wider">
                              <div>Cliente</div>
                              <div>E-mail</div>
                              <div>Consultor</div>
                              <div>Cadastro</div>
                            </div>
                            <div className="flex flex-col gap-2">
                              {clientsState.clients.map((client) => (
                                <div
                                  key={client.id}
                                  className="grid grid-cols-[2fr_2fr_2fr_1fr] gap-4 items-center px-3 py-3 bg-surface rounded-lg border border-border-soft"
                                >
                                  <div className="text-sm font-medium text-ink">
                                    {client.name} {client.surname}
                                  </div>
                                  <div className="text-sm text-muted truncate">
                                    {client.email}
                                  </div>
                                  <div className="text-sm text-ink-soft">
                                    {client.consultant
                                      ? `${client.consultant.name} ${client.consultant.surname}`
                                      : "—"}
                                  </div>
                                  <div className="text-xs text-subtle">
                                    {client.created_at
                                      ? new Date(client.created_at).toLocaleDateString("pt-BR")
                                      : "—"}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </>
                        )
                      ) : (
                        <>
                      {expandedState.loading &&
                      expandedState.consultants.length === 0 ? (
                        <div className="flex items-center justify-center py-6 gap-2 text-muted">
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span className="text-sm">Carregando consultores...</span>
                        </div>
                      ) : expandedState.error ? (
                        <p className="text-sm text-status-bad py-4 text-center">
                          {expandedState.error}
                        </p>
                      ) : expandedState.consultants.length === 0 ? (
                        <p className="text-sm text-muted py-4 text-center">
                          Nenhum consultor associado a este escritório.
                        </p>
                      ) : (
                        <>
                          {/* Cabeçalho da sub-tabela */}
                          <div className="grid grid-cols-[2fr_2fr_1fr_1fr] gap-4 px-3 py-2 text-xs font-semibold text-muted uppercase tracking-wider">
                            <div>Nome</div>
                            <div>E-mail</div>
                            <div>Clientes</div>
                            <div>Cadastro</div>
                          </div>

                          {/* Linhas de consultores */}
                          <div className="flex flex-col gap-2">
                            {expandedState.consultants.map((consultant) => (
                              <div
                                key={consultant.id}
                                className="grid grid-cols-[2fr_2fr_1fr_1fr] gap-4 items-center px-3 py-3 bg-surface rounded-lg border border-border-soft"
                              >
                                <div>
                                  <span className="text-sm font-medium text-ink">
                                    {consultant.name} {consultant.surname}
                                  </span>
                                  <span className="block text-xs text-subtle">
                                    Consultor
                                  </span>
                                </div>
                                <div className="text-sm text-muted truncate">
                                  {consultant.email}
                                </div>
                                <div>
                                  <span className="text-sm text-ink-soft font-medium">
                                    {consultant.clients_count ?? 0}
                                  </span>
                                </div>
                                <div className="text-xs text-subtle">
                                  {consultant.created_at
                                    ? new Date(consultant.created_at).toLocaleDateString("pt-BR")
                                    : "—"}
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Paginação dos consultores */}
                          {expandedState.pagination.total_pages > 1 && (
                            <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
                              <span className="text-xs text-muted">
                                Página {expandedState.pagination.current_page} de{" "}
                                {expandedState.pagination.total_pages} (
                                {expandedState.pagination.total}{" "}
                                {expandedState.pagination.total === 1 ? "consultor" : "consultores"})
                              </span>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() =>
                                    loadConsultants(
                                      company.id,
                                      expandedState.pagination.current_page - 1,
                                    )
                                  }
                                  disabled={
                                    !expandedState.pagination.has_prev ||
                                    expandedState.loading
                                  }
                                  className="p-1.5 rounded hover:bg-border-soft disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                >
                                  <ChevronLeft className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() =>
                                    loadConsultants(
                                      company.id,
                                      expandedState.pagination.current_page + 1,
                                    )
                                  }
                                  disabled={
                                    !expandedState.pagination.has_next ||
                                    expandedState.loading
                                  }
                                  className="p-1.5 rounded hover:bg-border-soft disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                >
                                  <ChevronRight className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* --- MODAIS --- */}

      {/* Modal para criar novo escritório ou editar existente */}
      <Dialog
        open={isNewCompanyModalOpen || !!companyToEdit}
        onOpenChange={(open) => {
          if (!open) {
            setIsNewCompanyModalOpen(false);
            setCompanyToEdit(null);
          }
        }}
      >
        <DialogContent
          open={isNewCompanyModalOpen || !!companyToEdit}
          title={companyToEdit ? "Editar Escritório" : "Novo Escritório"}
          hideTitle
        >
          <NewCompanyForm
            onSuccess={handleFormSuccess}
            companyToEdit={companyToEdit}
          />
        </DialogContent>
      </Dialog>

      {/* --- NOVO MODAL PARA CONFIRMAÇÃO DE EXCLUSÃO --- */}
      <Dialog open={!!companyToDelete} onOpenChange={(open) => !open && setCompanyToDelete(null)}>
        <DialogContent open={!!companyToDelete} title="Confirmar Exclusão" hideTitle>
          <div className="text-center">
            <h2 className="text-h2 font-semibold text-ink mb-4">Confirmar Exclusão</h2>
            <p className="text-text-secondary mb-8">
              Tem a certeza que deseja apagar o escritório{" "}
              <span className="font-bold">{companyToDelete?.name}</span>? Esta
              ação não pode ser desfeita.
            </p>
            <div className="flex justify-center gap-4">
              <Button variant="light" onClick={() => setCompanyToDelete(null)}>Cancelar</Button>
              <Button variant="danger" onClick={handleConfirmDelete}>Confirmar Exclusão</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de convite de consultor / gerente */}
      <Dialog open={!!inviteState} onOpenChange={(open) => !open && setInviteState(null)}>
        <DialogContent open={!!inviteState} title="Convidar" hideTitle>
          {inviteState && (
            <div className="space-y-4">
              <h2 className="text-h2 font-semibold text-ink">
                {inviteState.role === "OFFICE" ? "Convidar Gerente" : "Convidar Consultor"}
              </h2>
              <p className="text-sm text-muted">
                Escritório: <strong>{inviteState.companyName}</strong>
              </p>

              {inviteState.inviteLink ? (
                <div className="space-y-3">
                  <p className="text-sm text-status-ok font-medium">
                    Link de convite gerado! Envie para o {inviteState.role === "OFFICE" ? "gerente" : "consultor"}:
                  </p>
                  <div className="flex items-center gap-2 bg-border-soft border border-border rounded-md px-3 py-2">
                    <span className="text-xs text-ink-soft truncate flex-1 font-mono">
                      {inviteState.inviteLink}
                    </span>
                    <button
                      onClick={handleCopyLink}
                      className="shrink-0 p-1 rounded hover:bg-border-soft transition-colors"
                      title="Copiar link"
                    >
                      {inviteState.copied
                        ? <Check className="w-4 h-4 text-status-ok" />
                        : <Copy className="w-4 h-4 text-muted" />}
                    </button>
                  </div>
                  <p className="text-xs text-subtle">
                    O link expira em 7 dias. Um e-mail também foi enviado automaticamente.
                  </p>
                  <div className="flex justify-end pt-2">
                    <Button type="button" variant="light" onClick={() => setInviteState(null)}>
                      Fechar
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-ink-soft mb-1">
                      E-mail do {inviteState.role === "OFFICE" ? "gerente" : "consultor"}
                    </label>
                    <input
                      type="email"
                      value={inviteState.email}
                      onChange={(e) =>
                        setInviteState((prev) => prev ? { ...prev, email: e.target.value } : null)
                      }
                      placeholder={inviteState.role === "OFFICE" ? "gerente@exemplo.com" : "consultor@exemplo.com"}
                      className="block w-full px-3 py-2 border border-border rounded-md"
                      autoFocus
                    />
                  </div>

                  {inviteState.error && (
                    <p className="text-sm text-status-bad">{inviteState.error}</p>
                  )}

                  <div className="flex justify-end gap-3 pt-2">
                    <Button type="button" variant="light" onClick={() => setInviteState(null)}>
                      Cancelar
                    </Button>
                    <Button
                      type="button"
                      onClick={handleSendInvite}
                      disabled={inviteState.isLoading}
                    >
                      {inviteState.isLoading ? "Gerando..." : "Gerar Convite"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
