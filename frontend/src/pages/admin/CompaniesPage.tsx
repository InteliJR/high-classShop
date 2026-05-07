// Página de gestão de escritórios, com listagem, criação, exclusão e visualização de especialistas.

import { useEffect, useState, useContext, useCallback } from "react";
import {
  getCompanies,
  deleteCompany,
  getCompanySpecialists,
  type Company,
  type CompanySpecialist,
} from "../../services/companies.service";
import { updateSpecialist } from "../../services/specialists.service";
import {
  getPlatformCompany,
  type PlatformCompany,
} from "../../services/platform-company.service";
import type { PaginationMeta } from "../../types/types";
import Button from "../../components/ui/button";
import EditIcon from "../../assets/icons/edit.svg";
import TrashIcon from "../../assets/icons/trash.svg";
import Modal from "../../components/ui/Modal";
import NewCompanyForm from "./NewCompanyForm";
import { AppContext } from "../../contexts/AppContext";
import {
  ChevronDown,
  ChevronUp,
  Users,
  Calendar,
  Mail,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

// Estado de um painel de especialistas expandido por empresa
interface ExpandedCompanyState {
  specialists: CompanySpecialist[];
  pagination: PaginationMeta;
  loading: boolean;
  error: string | null;
}

interface SpecialistEditState {
  specialist: CompanySpecialist;
  companyId: string;
}

export default function CompaniesPage() {
  // Guarda os dados da API para serem renderizados na tabela.
  const [companies, setCompanies] = useState<Company[]>([]);
  // Controla a exibição de mensagens de 'loading' enquanto os dados são buscados.
  const [isLoading, setIsLoading] = useState(true);
  // Armazena mensagens de erro para exibir ao utilizador se a API falhar.
  const [error, setError] = useState<string | null>(null);

  // Dados da plataforma (taxa de comissão da plataforma)
  const [platformData, setPlatformData] = useState<PlatformCompany | null>(
    null,
  );

  // Controla a visibilidade do modal de criação de um novo escritório.
  const [isNewCompanyModalOpen, setIsNewCompanyModalOpen] = useState(false);
  // Guarda a empresa que está sendo editada, ou null se estiver criando uma nova.
  const [companyToEdit, setCompanyToEdit] = useState<Company | null>(null);
  // Guarda o objeto da empresa que está prestes a ser apagada, controlando também o modal de confirmação.
  const [companyToDelete, setCompanyToDelete] = useState<Company | null>(null);
  const [specialistToEdit, setSpecialistToEdit] =
    useState<SpecialistEditState | null>(null);
  const [isSavingSpecialist, setIsSavingSpecialist] = useState(false);
  const [specialistFormError, setSpecialistFormError] = useState<string | null>(
    null,
  );

  const [editName, setEditName] = useState("");
  const [editSurname, setEditSurname] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editSpeciality, setEditSpeciality] = useState<
    "CAR" | "BOAT" | "AIRCRAFT"
  >("CAR");
  const [editCommissionRate, setEditCommissionRate] = useState("");
  const [editCalendlyUrl, setEditCalendlyUrl] = useState("");

  // Mapa de empresas expandidas: companyId -> estado dos especialistas
  const [expandedCompanies, setExpandedCompanies] = useState<
    Record<string, ExpandedCompanyState>
  >({});

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
      const [companiesData, platform] = await Promise.all([
        getCompanies(),
        getPlatformCompany().catch(() => null),
      ]);
      setCompanies(companiesData);
      setPlatformData(platform);
      setError(null);
    } catch (err) {
      setError("Não foi possível carregar os escritórios.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Busca especialistas de uma empresa (lazy loading)
  const loadSpecialists = useCallback(
    async (companyId: string, page: number = 1) => {
      setExpandedCompanies((prev) => ({
        ...prev,
        [companyId]: {
          ...prev[companyId],
          loading: true,
          error: null,
          specialists: prev[companyId]?.specialists ?? [],
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
        const result = await getCompanySpecialists(companyId, page, 5);
        setExpandedCompanies((prev) => ({
          ...prev,
          [companyId]: {
            specialists: result.data,
            pagination: result.pagination,
            loading: false,
            error: null,
          },
        }));
      } catch (err) {
        setExpandedCompanies((prev) => ({
          ...prev,
          [companyId]: {
            ...prev[companyId],
            loading: false,
            error: "Erro ao carregar especialistas.",
          },
        }));
      }
    },
    [],
  );

  // Toggle expandir/colapsar empresa
  const toggleExpand = useCallback(
    (companyId: string) => {
      if (expandedCompanies[companyId]) {
        // Já está expandido — colapsar (remover do mapa)
        setExpandedCompanies((prev) => {
          const next = { ...prev };
          delete next[companyId];
          return next;
        });
      } else {
        // Expandir — buscar especialistas
        loadSpecialists(companyId, 1);
      }
    },
    [expandedCompanies, loadSpecialists],
  );

  const openSpecialistEditModal = useCallback(
    (specialist: CompanySpecialist, companyId: string) => {
      setSpecialistFormError(null);
      setSpecialistToEdit({ specialist, companyId });
      setEditName(specialist.name);
      setEditSurname(specialist.surname);
      setEditEmail(specialist.email);
      setEditSpeciality(
        (specialist.speciality as "CAR" | "BOAT" | "AIRCRAFT") || "CAR",
      );
      setEditCommissionRate(
        specialist.commission_rate != null
          ? String(specialist.commission_rate)
          : "",
      );
      setEditCalendlyUrl(specialist.calendly_url || "");
    },
    [],
  );

  const closeSpecialistEditModal = useCallback(() => {
    setSpecialistToEdit(null);
    setSpecialistFormError(null);
  }, []);

  const handleSaveSpecialist = useCallback(async () => {
    if (!specialistToEdit) return;

    if (!editName.trim() || !editSurname.trim() || !editEmail.trim()) {
      setSpecialistFormError("Nome, sobrenome e e-mail são obrigatórios.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(editEmail.trim())) {
      setSpecialistFormError("Informe um e-mail válido.");
      return;
    }

    const parsedCommission = editCommissionRate.trim()
      ? Number(editCommissionRate)
      : undefined;

    if (
      parsedCommission !== undefined &&
      (Number.isNaN(parsedCommission) ||
        parsedCommission < 0 ||
        parsedCommission > 100)
    ) {
      setSpecialistFormError("Comissão deve estar entre 0 e 100.");
      return;
    }

    setIsSavingSpecialist(true);
    setSpecialistFormError(null);

    try {
      await updateSpecialist(specialistToEdit.specialist.id, {
        name: editName.trim(),
        surname: editSurname.trim(),
        email: editEmail.trim(),
        speciality: editSpeciality,
        commission_rate: parsedCommission,
        calendly_url: editCalendlyUrl.trim() || undefined,
      });

      const currentPage =
        expandedCompanies[specialistToEdit.companyId]?.pagination
          .current_page || 1;
      await loadSpecialists(specialistToEdit.companyId, currentPage);
      closeSpecialistEditModal();
    } catch (err) {
      setSpecialistFormError(
        (err as Error).message || "Erro ao atualizar especialista.",
      );
    } finally {
      setIsSavingSpecialist(false);
    }
  }, [
    specialistToEdit,
    editName,
    editSurname,
    editEmail,
    editSpeciality,
    editCommissionRate,
    editCalendlyUrl,
    expandedCompanies,
    loadSpecialists,
    closeSpecialistEditModal,
  ]);

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

  const platformRate = platformData?.default_commission_rate ?? null;

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
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-5 px-4 py-2 text-base font-normal text-left text-text-secondary min-w-[700px]">
          <div>Empresa</div>
          <div>% Plataforma</div>
          <div>% Escritório</div>
          <div>Especialistas</div>
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

              return (
                <div
                  key={company.id}
                  className="rounded-lg shadow-sm bg-white overflow-hidden"
                >
                  {/* Linha principal da empresa */}
                  <div className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-5 items-center bg-brand-card p-6 min-w-[700px]">
                    <div className="flex items-center gap-3">
                      {/* Botão expand/collapse */}
                      <button
                        onClick={() => toggleExpand(company.id)}
                        className="p-1 rounded hover:bg-gray-100 transition-colors"
                        title={
                          isExpanded
                            ? "Recolher especialistas"
                            : "Ver especialistas"
                        }
                      >
                        {isExpanded ? (
                          <ChevronUp className="w-5 h-5 text-gray-500" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-gray-500" />
                        )}
                      </button>
                      {company.logo ? (
                        <img
                          src={`data:image/png;base64,${company.logo}`}
                          alt={company.name}
                          className="h-8 w-24 object-contain"
                        />
                      ) : (
                        <div className="h-8 w-24 flex items-center justify-center bg-gray-200 rounded text-xs text-gray-500">
                          Sem Logo
                        </div>
                      )}
                      <div>
                        <span className="font-medium">{company.name}</span>
                        <span className="block text-xs text-gray-400">
                          {company.cnpj}
                        </span>
                      </div>
                    </div>

                    {/* % Plataforma */}
                    <div>
                      {platformRate !== null ? (
                        <span className="inline-flex items-center gap-1 text-sm font-medium text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full">
                          {platformRate}%
                        </span>
                      ) : (
                        <span className="text-gray-400 text-sm">—</span>
                      )}
                    </div>

                    {/* % Escritório */}
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

                    {/* Especialistas count */}
                    <div>
                      <button
                        onClick={() => toggleExpand(company.id)}
                        className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors"
                      >
                        <Users className="w-4 h-4" />
                        <span className="font-medium">
                          {company.specialists_count ?? 0}
                        </span>
                      </button>
                    </div>

                    {/* Ações */}
                    <div className="flex justify-end items-center gap-4 text-gray-400">
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

                  {/* Painel expandido: especialistas */}
                  {isExpanded && (
                    <div className="border-t border-gray-100 bg-gray-50 px-6 py-4">
                      {expandedState.loading &&
                      expandedState.specialists.length === 0 ? (
                        <div className="flex items-center justify-center py-6 gap-2 text-gray-500">
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span className="text-sm">
                            Carregando especialistas...
                          </span>
                        </div>
                      ) : expandedState.error ? (
                        <p className="text-sm text-red-500 py-4 text-center">
                          {expandedState.error}
                        </p>
                      ) : expandedState.specialists.length === 0 ? (
                        <p className="text-sm text-gray-500 py-4 text-center">
                          Nenhum especialista associado a este escritório.
                        </p>
                      ) : (
                        <>
                          {/* Cabeçalho da sub-tabela */}
                          <div className="grid grid-cols-[2fr_1.5fr_1fr_1fr_0.8fr_0.8fr] gap-4 px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            <div>Nome</div>
                            <div>E-mail</div>
                            <div>Especialidade</div>
                            <div>% Comissão</div>
                            <div>Calendly</div>
                            <div className="text-right">Ações</div>
                          </div>

                          {/* Linhas de especialistas */}
                          <div className="flex flex-col gap-2">
                            {expandedState.specialists.map((spec) => (
                              <div
                                key={spec.id}
                                className="grid grid-cols-[2fr_1.5fr_1fr_1fr_0.8fr_0.8fr] gap-4 items-center px-3 py-3 bg-white rounded-lg border border-gray-100"
                              >
                                <div>
                                  <span className="text-sm font-medium text-gray-900">
                                    {spec.name} {spec.surname}
                                  </span>
                                  <span className="block text-xs text-gray-400 capitalize">
                                    {spec.role === "SPECIALIST"
                                      ? "Especialista"
                                      : spec.role === "CONSULTANT"
                                        ? "Consultor"
                                        : spec.role}
                                  </span>
                                </div>
                                <div className="text-sm text-gray-600 truncate">
                                  {spec.email}
                                </div>
                                <div>
                                  {spec.speciality ? (
                                    <span className="text-xs font-medium text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full">
                                      {spec.speciality === "CAR"
                                        ? "Carros"
                                        : spec.speciality === "BOAT"
                                          ? "Lanchas"
                                          : spec.speciality === "AIRCRAFT"
                                            ? "Aeronaves"
                                            : spec.speciality}
                                    </span>
                                  ) : (
                                    <span className="text-xs text-gray-400">
                                      —
                                    </span>
                                  )}
                                </div>
                                <div>
                                  {spec.commission_rate != null ? (
                                    <span className="text-sm font-medium text-emerald-700">
                                      {spec.commission_rate}%
                                    </span>
                                  ) : (
                                    <span className="text-xs text-gray-400">
                                      —
                                    </span>
                                  )}
                                </div>
                                <div>
                                  {spec.calendly_url?.trim() ? (
                                    <span
                                      className="inline-flex items-center gap-1 text-xs text-green-700"
                                      title={spec.calendly_url}
                                    >
                                      <Calendar className="w-3.5 h-3.5" />
                                      Ativo
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                                      <Mail className="w-3.5 h-3.5" />
                                      E-mail
                                    </span>
                                  )}
                                </div>
                                <div className="flex justify-end">
                                  <button
                                    onClick={() =>
                                      openSpecialistEditModal(spec, company.id)
                                    }
                                    className="p-1 rounded hover:bg-gray-100 transition-colors"
                                    title="Editar especialista"
                                  >
                                    <img
                                      src={EditIcon}
                                      alt="Editar especialista"
                                      className="h-4 w-4"
                                    />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Paginação dos especialistas */}
                          {expandedState.pagination.total_pages > 1 && (
                            <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-200">
                              <span className="text-xs text-gray-500">
                                Página {expandedState.pagination.current_page}{" "}
                                de {expandedState.pagination.total_pages} (
                                {expandedState.pagination.total}{" "}
                                {expandedState.pagination.total === 1
                                  ? "membro"
                                  : "membros"}
                                )
                              </span>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() =>
                                    loadSpecialists(
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
                                    loadSpecialists(
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

      <Modal isOpen={!!specialistToEdit} onClose={closeSpecialistEditModal}>
        <div className="space-y-4">
          <h2 className="h2-style">Editar Especialista</h2>

          <div>
            <label className="block text-sm font-medium text-text-secondary">
              Nome
            </label>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-brand-border rounded-md shadow-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary">
              Sobrenome
            </label>
            <input
              type="text"
              value={editSurname}
              onChange={(e) => setEditSurname(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-brand-border rounded-md shadow-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary">
              E-mail
            </label>
            <input
              type="email"
              value={editEmail}
              onChange={(e) => setEditEmail(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-brand-border rounded-md shadow-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary">
              Especialidade
            </label>
            <select
              value={editSpeciality}
              onChange={(e) =>
                setEditSpeciality(e.target.value as "CAR" | "BOAT" | "AIRCRAFT")
              }
              className="mt-1 block w-full px-3 py-2 border border-brand-border rounded-md shadow-sm"
            >
              <option value="CAR">Carros</option>
              <option value="BOAT">Lanchas</option>
              <option value="AIRCRAFT">Aeronaves</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary">
              Comissão (%)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={editCommissionRate}
              onChange={(e) => setEditCommissionRate(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-brand-border rounded-md shadow-sm"
              placeholder="Ex: 12.5"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary">
              Calendly URL
            </label>
            <input
              type="url"
              value={editCalendlyUrl}
              onChange={(e) => setEditCalendlyUrl(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-brand-border rounded-md shadow-sm"
              placeholder="https://calendly.com/..."
            />
          </div>

          {specialistFormError && (
            <p className="text-sm text-red-500">{specialistFormError}</p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" onClick={closeSpecialistEditModal}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleSaveSpecialist}
              disabled={isSavingSpecialist}
            >
              {isSavingSpecialist ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
