import React, { useEffect, useState } from "react";
import { getCompanies, deleteCompany, type Company } from "../../services/companies.service";
import Button from "../../components/ui/Button";
import EditIcon from "../../assets/icons/edit.svg";
import TrashIcon from "../../assets/icons/trash.svg";
import Modal from "../../components/ui/Modal";
import NewCompanyForm from "./NewCompanyForm";

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  

  const [isNewCompanyModalOpen, setIsNewCompanyModalOpen] = useState(false);
  const [companyToDelete, setCompanyToDelete] = useState<Company | null>(null);

  const handleFormSuccess = () => {
    setIsNewCompanyModalOpen(false);
    fetchData();
  };

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

  if (isLoading) {
    return <p>Carregando...</p>;
  }

  if (error) {
    return <p className="text-red-500">{error}</p>;
  }

  return (
    <div className="text-text-main w-full">
      <div className="flex justify-between items-center mb-6">
        <h1 className="h1-style">Gestão de Escritórios</h1>
        <Button type="button" onClick={() => setIsNewCompanyModalOpen(true)}>
          + Novo Escritório
        </Button>
      </div>

      <div className="p-6 rounded-lg shadow bg-brand-container bg-bg-container">
        <h2 className="h2-style">Escritórios</h2>
        <p className="text-base mb-8 mt-2">
          Lista completa de empresa parceiras
        </p>

        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-5 px-4 py-2 text-base font-normal text-left text-text-secondary">
          <div>Empresa</div>
          <div>Processos Abertos</div>
          <div>Status</div>
          <div>Consultor</div>
          <div className="text-right">Ações</div>
        </div>

        <div className="mt-4 flex flex-col gap-4 max-h-[70vh] overflow-y-auto p-2">
          {companies.map((company) => (
            <div
              key={company.id}
              className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-5 items-center bg-brand-card p-6 rounded-lg shadow-sm bg-white"
            >
              <div className="flex items-center gap-3">
                {company.logoUrl ? (
                  <img src={company.logoUrl} alt={company.name} className="h-8 w-24 object-contain" />
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
                <button>
                  <img src={EditIcon} alt="Editar" className="h-6 w-6 cursor-pointer" />
                </button>

                <button onClick={() => setCompanyToDelete(company)}>
                  <img src={TrashIcon} alt="Deletar" className="h-5 w-5 cursor-pointer" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal para criar novo escritório */}
      <Modal isOpen={isNewCompanyModalOpen} onClose={() => setIsNewCompanyModalOpen(false)}>
        <NewCompanyForm onSuccess={handleFormSuccess} />
      </Modal>

      {/* --- NOVO MODAL PARA CONFIRMAÇÃO DE EXCLUSÃO --- */}
      <Modal isOpen={!!companyToDelete} onClose={() => setCompanyToDelete(null)}>
        <div className="text-center">
          <h2 className="h2-style mb-4">Confirmar Exclusão</h2>
          <p className="text-text-secondary mb-8">
            Tem a certeza que deseja apagar o escritório <span className="font-bold">{companyToDelete?.name}</span>? Esta ação não pode ser desfeita.
          </p>
          <div className="flex justify-center gap-4">
            <Button
              onClick={() => setCompanyToDelete(null)}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmDelete}
            >
              Confirmar Exclusão
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
