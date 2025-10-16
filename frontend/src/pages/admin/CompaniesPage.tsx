import React, { useEffect, useState } from "react";
import { getCompanies, type Company } from "../../services/companies.service";
import Button from "../../components/ui/button";
import EditIcon from "../../assets/icons/edit.svg";
import TrashIcon from "../../assets/icons/trash.svg";
import Modal from "../../components/ui/Modal";
import NewCompanyForm from "./NewCompanyForm";

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleFormSuccess = () => {
    setIsModalOpen(false);
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
        <Button type="button" onClick={() => setIsModalOpen(true)}>
          + Novo Escritório
        </Button>
      </div>

      {/* Tabela de Escritórios */}
      <div className="p-6 rounded-lg shadow bg-bg-container">
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

        {/* Corpo da Lista */}
        <div className="mt-2 space-y-4 overflow-y-auto p-2 rounded-xl">
          {companies.map((company) => (
            <div
              key={company.id}
              className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-5 items-center bg-brand-card p-6 rounded-lg shadow-sm bg-white"
            >
              <div className="flex items-center gap-3">
                {/* O logo virá da API no futuro */}
                <img
                  src={`https://via.placeholder.com/100x40.png/ddd/000?text=${
                    company.name.split(" ")[0]
                  }`}
                  alt={company.name}
                  className="h-6 object-contain"
                />
                <span className="font-normal">{company.name}</span>
              </div>
              <div>0</div> {/* Placeholder */}
              <div>
                <span className="bg-status-active-bg text-normal font-normal rounded-full">
                  Ativo
                </span>
              </div>{" "}
              {/* Placeholder */}
              <div>-</div> {/* Placeholder */}
              <div className="flex justify-end items-center gap-4 text-gray-400">
                <button>
                  <img
                    src={EditIcon}
                    alt="Editar"
                    className="h-6 w-6 cursor-pointer"
                  />
                </button>
                <button>
                  <img
                    src={TrashIcon}
                    alt="Deletar"
                    className="h-5 w-5 cursor-pointer"
                  />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <NewCompanyForm onSuccess={handleFormSuccess} />
      </Modal>
    </div>
  );
}
