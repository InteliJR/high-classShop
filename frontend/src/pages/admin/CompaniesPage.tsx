// Página de gestão de escritórios, com listagem, criação e exclusão.

import { useEffect, useState } from "react";
import {
  getCompanies,
  deleteCompany,
  type Company,
} from "../../services/companies.service";
import Button from "../../components/ui/button";
import EditIcon from "../../assets/icons/edit.svg";
import TrashIcon from "../../assets/icons/trash.svg";
import Modal from "../../components/ui/Modal";
import NewCompanyForm from "./NewCompanyForm";

export default function CompaniesPage() {
  // Guarda os dados da API para serem renderizados na tabela.
  const [companies, setCompanies] = useState<Company[]>([]);
  // Controla a exibição de mensagens de 'loading' enquanto os dados são buscados.
  const [isLoading, setIsLoading] = useState(true);
  // Armazena mensagens de erro para exibir ao utilizador se a API falhar.
  const [error, setError] = useState<string | null>(null);

  // Controla a visibilidade do modal de criação de um novo escritório.
  const [isNewCompanyModalOpen, setIsNewCompanyModalOpen] = useState(false);
  // Guarda a empresa que está sendo editada, ou null se estiver criando uma nova.
  const [companyToEdit, setCompanyToEdit] = useState<Company | null>(null);
  // Guarda o objeto da empresa que está prestes a ser apagada, controlando também o modal de confirmação.
  const [companyToDelete, setCompanyToDelete] = useState<Company | null>(null);

  // Busca os dados mais recentes da API e atualiza o estado da página.
  async function fetchData() {
    try {
      setIsLoading(true);
      const data = await getCompanies();
      setCompanies(data);
      setError(null);
    } catch (err) {
      setError("Não foi possível carregar os escritórios.");
    } finally {
      setIsLoading(false);
    }
  }

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
      alert("Erro ao apagar o escritório. Tente novamente.");
    } finally {
      setCompanyToDelete(null);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Exibe uma mensagem de 'loading' enquanto os dados não chegam.
  if (isLoading) {
    return <p>Carregando...</p>;
  }

  // Exibe uma mensagem de erro se a busca de dados falhar.
  if (error) {
    return <p className="text-red-500">{error}</p>;
  }

  return (
    <div className="text-text-main w-full">
      {/* --- CABEÇALHO DA PÁGINA --- */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="h1-style">Gestão de Escritórios</h1>
        <Button type="button" onClick={() => setIsNewCompanyModalOpen(true)}>
          + Novo Escritório
        </Button>
      </div>

      {/* --- TABELA DE ESCRITÓRIOS --- */}
      <div className="p-6 rounded-lg shadow bg-brand-container bg-bg-container">
        <h2 className="h2-style">Escritórios</h2>
        <p className="text-base mb-8 mt-2">
          Lista completa de empresa parceiras
        </p>

        {/* Cabeçalho da Lista */}
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-5 px-4 py-2 text-base font-normal text-left text-text-secondary">
          <div>Empresa</div>
          <div>Processos Abertos</div>
          <div>Status</div>
          <div>Consultor</div>
          <div className="text-right">Ações</div>
        </div>

        {/* Corpo da Lista */}
        <div className="mt-4 flex flex-col gap-4 max-h-[70vh] overflow-y-auto p-2">
          {companies.map((company) => (
            <div
              key={company.id}
              className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-5 items-center bg-brand-card p-6 rounded-lg shadow-sm bg-white"
            >
              <div className="flex items-center gap-3">
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
                <span className="font-normal">{company.name}</span>
              </div>
              <div>0</div>
              <div>
                <span className="bg-status-active-bg text-status-active-text text-base px-2.5 py-0.5 rounded-full">
                  Ativo
                </span>
              </div>
              <div>-</div>
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
          ))}
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
    </div>
  );
}
