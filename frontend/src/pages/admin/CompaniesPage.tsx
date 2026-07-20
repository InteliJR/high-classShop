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
import EditIcon from "../../assets/icons/edit.svg";
import TrashIcon from "../../assets/icons/trash.svg";
import Modal from "../../components/ui/Modal";
import NewCompanyForm from "./NewCompanyForm";
import { AppContext } from "../../contexts/AppContext";
import { resolveCompanyLogo } from "../../utils/branding";
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
          <div className="w-12 h-12 border-3 border-gray-200 border-t-primary rounded-full animate-spin" />
          <p className="text-gray-600">Carregando empresas...</p>
        </div>
      </div>
    );
  }

  // Exibe uma mensagem de erro se a busca de dados falhar.
  if (error) {
    return <p className="text-red-500">{error}</p>;
  }


  return (
    <div className="text-text-main w-full">
      {/* --- CABEÇALHO DA PÁGINA --- */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="h1-style">Gestão de Escritórios</h1>
        <Button type="button" onClick={() => setIsNewCompanyModalOpen(true)}>
          + Novo Escritório
        </Button>
      </div>

      {/* --- TABELA DE ESCRITÓRIOS --- */}
      <div className="p-6 rounded-lg shadow bg-brand-container bg-bg-container overflow-x-auto">
        <h2 className="h2-style">Escritórios</h2>
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
            <p className="text-center text-gray-500 py-8">
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
                  className="rounded-lg shadow-sm bg-white overflow-hidden"
                >
                  {/* Linha principal da empresa */}
                  <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_auto] gap-3 md:gap-5 items-start md:items-center bg-brand-card p-4 md:p-6">
                    <div className="flex items-center gap-3">
                      {/* Botão expand/collapse */}
                      <button
                        onClick={() => toggleExpand(company.id)}
                        className="p-1 rounded hover:bg-gray-100 transition-colors"
                        title={
                          isExpanded
                            ? "Recolher consultores"
                            : "Ver consultores"
                        }
                      >
                        {isExpanded ? (
                          <ChevronUp className="w-5 h-5 text-gray-500" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-gray-500" />
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
                          <div className="h-8 w-24 flex items-center justify-center bg-gray-200 rounded text-xs text-gray-500">
                            Sem Logo
                          </div>
                        );
                      })()}
                      <div>
                        <span className="font-medium">{company.name}</span>
                        <span className="block text-xs text-gray-400">
                          {company.cnpj}
                        </span>
                      </div>
                    </div>

                    {/* % Escritório (fatia do restante) */}
                    <div>
                      {company.commission_rate != null ? (
                        <span className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">
                          {company.commission_rate}%
                        </span>
                      ) : (
                        <span className="text-gray-400 text-sm">
                          Não definida
                        </span>
                      )}
                    </div>

                    {/* Consultores count */}
                    <div>
                      <button
                        onClick={() => toggleExpand(company.id)}
                        className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors"
                      >
                        <Users className="w-4 h-4" />
                        <span className="font-medium">
                          {company.consultants_count ?? 0}
                        </span>
                      </button>
                    </div>

                    {/* Ações */}
                    <div className="flex justify-end items-center gap-4 text-gray-400">
                      <button
                        title="Convidar gerente do escritório (OFFICE)"
                        onClick={() => openInviteModal(company, "OFFICE")}
                        className="text-xs font-medium bg-gray-800 text-white px-2 py-1 rounded hover:bg-black"
                      >
                        + Gerente
                      </button>
                      <button onClick={() => setCompanyToEdit(company)}>
                        <img
                          src={EditIcon}
                          alt="Editar"
                          className="h-6 w-6 cursor-pointer hover:text-gray-600"
                        />
                      </button>
                      <button onClick={() => setCompanyToDelete(company)}>
                        <img
                          src={TrashIcon}
                          alt="Deletar"
                          className="h-5 w-5 cursor-pointer hover:text-gray-600"
                        />
                      </button>
                    </div>
                  </div>

                  {/* Painel expandido: consultores / clientes */}
                  {isExpanded && (
                    <div className="border-t border-gray-100 bg-gray-50 px-6 py-4">
                      {/* Header do painel: abas + botão convidar */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-4">
                          <button
                            onClick={() => switchPanelTab(company.id, "consultants")}
                            className={`text-xs font-semibold uppercase tracking-wider pb-1 border-b-2 -mb-px ${
                              activeTab === "consultants"
                                ? "border-slate-700 text-gray-900"
                                : "border-transparent text-gray-400 hover:text-gray-600"
                            }`}
                          >
                            Consultores
                          </button>
                          <button
                            onClick={() => switchPanelTab(company.id, "clients")}
                            className={`text-xs font-semibold uppercase tracking-wider pb-1 border-b-2 -mb-px ${
                              activeTab === "clients"
                                ? "border-slate-700 text-gray-900"
                                : "border-transparent text-gray-400 hover:text-gray-600"
                            }`}
                          >
                            Clientes
                          </button>
                        </div>
                        {activeTab === "consultants" && (
                          <button
                            onClick={() => openInviteModal(company)}
                            className="inline-flex items-center gap-1.5 text-xs font-medium bg-black text-white px-3 py-1.5 rounded hover:bg-gray-800 transition-colors"
                          >
                            <Link className="w-3.5 h-3.5" />
                            Convidar Consultor
                          </button>
                        )}
                      </div>

                      {activeTab === "clients" ? (
                        clientsState?.loading ? (
                          <div className="flex items-center justify-center py-6 gap-2 text-gray-500">
                            <Loader2 className="w-5 h-5 animate-spin" />
                            <span className="text-sm">Carregando clientes...</span>
                          </div>
                        ) : clientsState?.error ? (
                          <p className="text-sm text-red-500 py-4 text-center">
                            {clientsState.error}
                          </p>
                        ) : !clientsState || clientsState.clients.length === 0 ? (
                          <p className="text-sm text-gray-500 py-4 text-center">
                            Nenhum cliente ligado a consultores deste escritório.
                          </p>
                        ) : (
                          <>
                            <div className="grid grid-cols-[2fr_2fr_2fr_1fr] gap-4 px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                              <div>Cliente</div>
                              <div>E-mail</div>
                              <div>Consultor</div>
                              <div>Cadastro</div>
                            </div>
                            <div className="flex flex-col gap-2">
                              {clientsState.clients.map((client) => (
                                <div
                                  key={client.id}
                                  className="grid grid-cols-[2fr_2fr_2fr_1fr] gap-4 items-center px-3 py-3 bg-white rounded-lg border border-gray-100"
                                >
                                  <div className="text-sm font-medium text-gray-900">
                                    {client.name} {client.surname}
                                  </div>
                                  <div className="text-sm text-gray-600 truncate">
                                    {client.email}
                                  </div>
                                  <div className="text-sm text-gray-700">
                                    {client.consultant
                                      ? `${client.consultant.name} ${client.consultant.surname}`
                                      : "—"}
                                  </div>
                                  <div className="text-xs text-gray-400">
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
                        <div className="flex items-center justify-center py-6 gap-2 text-gray-500">
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span className="text-sm">Carregando consultores...</span>
                        </div>
                      ) : expandedState.error ? (
                        <p className="text-sm text-red-500 py-4 text-center">
                          {expandedState.error}
                        </p>
                      ) : expandedState.consultants.length === 0 ? (
                        <p className="text-sm text-gray-500 py-4 text-center">
                          Nenhum consultor associado a este escritório.
                        </p>
                      ) : (
                        <>
                          {/* Cabeçalho da sub-tabela */}
                          <div className="grid grid-cols-[2fr_2fr_1fr_1fr] gap-4 px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
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
                                className="grid grid-cols-[2fr_2fr_1fr_1fr] gap-4 items-center px-3 py-3 bg-white rounded-lg border border-gray-100"
                              >
                                <div>
                                  <span className="text-sm font-medium text-gray-900">
                                    {consultant.name} {consultant.surname}
                                  </span>
                                  <span className="block text-xs text-gray-400">
                                    Consultor
                                  </span>
                                </div>
                                <div className="text-sm text-gray-600 truncate">
                                  {consultant.email}
                                </div>
                                <div>
                                  <span className="text-sm text-gray-700 font-medium">
                                    {consultant.clients_count ?? 0}
                                  </span>
                                </div>
                                <div className="text-xs text-gray-400">
                                  {consultant.created_at
                                    ? new Date(consultant.created_at).toLocaleDateString("pt-BR")
                                    : "—"}
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Paginação dos consultores */}
                          {expandedState.pagination.total_pages > 1 && (
                            <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-200">
                              <span className="text-xs text-gray-500">
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
                                  className="p-1.5 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
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
                                  className="p-1.5 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
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
      <Modal
        isOpen={isNewCompanyModalOpen || !!companyToEdit}
        onClose={() => {
          setIsNewCompanyModalOpen(false);
          setCompanyToEdit(null);
        }}
      >
        <NewCompanyForm
          onSuccess={handleFormSuccess}
          companyToEdit={companyToEdit}
        />
      </Modal>

      {/* --- NOVO MODAL PARA CONFIRMAÇÃO DE EXCLUSÃO --- */}
      <Modal
        isOpen={!!companyToDelete}
        onClose={() => setCompanyToDelete(null)}
      >
        <div className="text-center">
          <h2 className="h2-style mb-4">Confirmar Exclusão</h2>
          <p className="text-text-secondary mb-8">
            Tem a certeza que deseja apagar o escritório{" "}
            <span className="font-bold">{companyToDelete?.name}</span>? Esta
            ação não pode ser desfeita.
          </p>
          <div className="flex justify-center gap-4">
            <Button onClick={() => setCompanyToDelete(null)}>Cancelar</Button>
            <Button onClick={handleConfirmDelete}>Confirmar Exclusão</Button>
          </div>
        </div>
      </Modal>

      {/* Modal de convite de consultor / gerente */}
      <Modal isOpen={!!inviteState} onClose={() => setInviteState(null)}>
        {inviteState && (
          <div className="space-y-4">
            <h2 className="h2-style">
              {inviteState.role === "OFFICE" ? "Convidar Gerente" : "Convidar Consultor"}
            </h2>
            <p className="text-sm text-gray-500">
              Escritório: <strong>{inviteState.companyName}</strong>
            </p>

            {inviteState.inviteLink ? (
              <div className="space-y-3">
                <p className="text-sm text-green-700 font-medium">
                  Link de convite gerado! Envie para o {inviteState.role === "OFFICE" ? "gerente" : "consultor"}:
                </p>
                <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-md px-3 py-2">
                  <span className="text-xs text-gray-700 truncate flex-1 font-mono">
                    {inviteState.inviteLink}
                  </span>
                  <button
                    onClick={handleCopyLink}
                    className="shrink-0 p-1 rounded hover:bg-gray-200 transition-colors"
                    title="Copiar link"
                  >
                    {inviteState.copied
                      ? <Check className="w-4 h-4 text-green-600" />
                      : <Copy className="w-4 h-4 text-gray-500" />}
                  </button>
                </div>
                <p className="text-xs text-gray-400">
                  O link expira em 7 dias. Um e-mail também foi enviado automaticamente.
                </p>
                <div className="flex justify-end pt-2">
                  <Button type="button" onClick={() => setInviteState(null)}>
                    Fechar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    E-mail do {inviteState.role === "OFFICE" ? "gerente" : "consultor"}
                  </label>
                  <input
                    type="email"
                    value={inviteState.email}
                    onChange={(e) =>
                      setInviteState((prev) => prev ? { ...prev, email: e.target.value } : null)
                    }
                    placeholder={inviteState.role === "OFFICE" ? "gerente@exemplo.com" : "consultor@exemplo.com"}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md"
                    autoFocus
                  />
                </div>

                {inviteState.error && (
                  <p className="text-sm text-red-500">{inviteState.error}</p>
                )}

                <div className="flex justify-end gap-3 pt-2">
                  <Button type="button" onClick={() => setInviteState(null)}>
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
      </Modal>
    </div>
  );
}
