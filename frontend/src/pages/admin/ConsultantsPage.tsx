// Página de gestão de consultores, com listagem, criação e exclusão.

import React, { useEffect, useState, useContext } from "react";
import {
  getConsultants,
  deleteConsultant,
  type Consultant,
} from "../../services/consultants.service";
import Button from "../../components/ui/button";
import EditIcon from "../../assets/icons/edit.svg";
import TrashIcon from "../../assets/icons/trash.svg";
import Modal from "../../components/ui/Modal";
import NewConsultantForm from "./NewConsultantForm";
import { AppContext } from "../../contexts/AppContext";

export default function ConsultantsPage() {
  // Guarda os dados da API para serem renderizados na tabela.
  const [consultants, setConsultants] = useState<Consultant[]>([]);
  // Controla a exibição de mensagens de 'loading' enquanto os dados são buscados.
  const [isLoading, setIsLoading] = useState(true);
  // Armazena mensagens de erro para exibir ao utilizador se a API falhar.
  const [error, setError] = useState<string | null>(null);

  // Controla a visibilidade do modal de criação de um novo consultor.
  const [isNewConsultantModalOpen, setIsNewConsultantModalOpen] = useState(false);
  // Guarda o consultor que está sendo editado, ou null se estiver criando um novo.
  const [consultantToEdit, setConsultantToEdit] = useState<Consultant | null>(null);
  // Guarda o objeto do consultor que está prestes a ser apagado, controlando também o modal de confirmação.
  const [consultantToDelete, setConsultantToDelete] = useState<Consultant | null>(null);

  // Usa o contexto de busca global
  const { searchTerm } = useContext(AppContext);

  // Filtra os consultores com base no termo de busca
  const filteredConsultants = consultants.filter((consultant) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      consultant.name.toLowerCase().includes(searchLower) ||
      consultant.surname.toLowerCase().includes(searchLower) ||
      consultant.email.toLowerCase().includes(searchLower)
    );
  });

  // Busca os dados mais recentes da API e atualiza o estado da página.
  async function fetchData() {
    try {
      setIsLoading(true);
      const data = await getConsultants();
      setConsultants(data);
      setError(null);
    } catch (err) {
      setError("Não foi possível carregar os consultores.");
    } finally {
      setIsLoading(false);
    }
  }

  // Função chamada quando o formulário de novo/edição de consultor é submetido com sucesso.
  const handleFormSuccess = () => {
    setIsNewConsultantModalOpen(false);
    setConsultantToEdit(null);
    fetchData();
  };

  // Função chamada pelo modal de confirmação para apagar um consultor.
  const handleConfirmDelete = async () => {
    if (!consultantToDelete) return;
    try {
      await deleteConsultant(consultantToDelete.id);
      fetchData();
    } catch (err) {
      const errorMessage = (err as Error).message || "Erro ao apagar o consultor. Tente novamente.";
      alert(errorMessage);
    } finally {
      setConsultantToDelete(null);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Exibe uma mensagem de 'loading' enquanto os dados não chegam.
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-3 border-gray-200 border-t-primary rounded-full animate-spin" />
          <p className="text-gray-600">Carregando consultores...</p>
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
      <div className="flex justify-between items-center mb-6">
        <h1 className="h1-style">Gestão de Consultores</h1>
        <Button type="button" onClick={() => setIsNewConsultantModalOpen(true)}>
          + Novo Consultor
        </Button>
      </div>

      {/* --- TABELA DE CONSULTORES --- */}
      <div className="p-6 rounded-lg shadow bg-brand-container bg-bg-container">
        <h2 className="h2-style">Consultores</h2>
        <p className="text-base mb-8 mt-2">
          Lista completa de consultores
        </p>

        {/* Cabeçalho da Lista */}
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-5 px-4 py-2 text-base font-normal text-left text-text-secondary">
          <div>Nome</div>
          <div>Email</div>
          <div>CPF</div>
          <div>Status</div>
          <div className="text-right">Ações</div>
        </div>

        {/* Corpo da Lista */}
        <div className="mt-4 flex flex-col gap-4 max-h-[70vh] overflow-y-auto p-2">
          {filteredConsultants.length === 0 ? (
            <p className="text-center text-gray-500 py-8">
              {searchTerm ? "Nenhum consultor encontrado com esse termo de busca." : "Nenhum consultor cadastrado."}
            </p>
          ) : (
            filteredConsultants.map((consultant) => (
            <div
              key={consultant.id}
              className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-5 items-center bg-brand-card p-6 rounded-lg shadow-sm bg-white"
            >
              <div className="flex items-center gap-3">
                <span className="font-normal">{consultant.name} {consultant.surname}</span>
              </div>
              <div>{consultant.email}</div>
              <div>{consultant.cpf}</div>
              <div>
                <span className="bg-status-active-bg text-status-active-text text-base px-2.5 py-0.5 rounded-full">
                  Ativo
                </span>
              </div>
              <div className="flex justify-end items-center gap-4 text-gray-400">
                <button onClick={() => setConsultantToEdit(consultant)}>
                  <img
                    src={EditIcon}
                    alt="Editar"
                    className="h-6 w-6 cursor-pointer hover:text-gray-600"
                  />
                </button>

                <button onClick={() => setConsultantToDelete(consultant)}>
                  <img
                    src={TrashIcon}
                    alt="Deletar"
                    className="h-5 w-5 cursor-pointer hover:text-gray-600"
                  />
                </button>
              </div>
            </div>
            ))
          )}
        </div>
      </div>

      {/* --- MODAIS --- */}

      {/* Modal para criar novo consultor ou editar existente */}
      <Modal
        isOpen={isNewConsultantModalOpen || !!consultantToEdit}
        onClose={() => {
          setIsNewConsultantModalOpen(false);
          setConsultantToEdit(null);
        }}
      >
        <NewConsultantForm
          onSuccess={handleFormSuccess}
          consultantToEdit={consultantToEdit}
        />
      </Modal>

      {/* --- NOVO MODAL PARA CONFIRMAÇÃO DE EXCLUSÃO --- */}
      <Modal
        isOpen={!!consultantToDelete}
        onClose={() => setConsultantToDelete(null)}
      >
        <div className="text-center">
          <h2 className="h2-style mb-4">Confirmar Exclusão</h2>
          <p className="text-text-secondary mb-8">
            Tem a certeza que deseja apagar o consultor{" "}
            <span className="font-bold">{consultantToDelete?.name}</span>? Esta
            ação não pode ser desfeita.
          </p>
          <div className="flex justify-center gap-4">
            <Button onClick={() => setConsultantToDelete(null)}>Cancelar</Button>
            <Button onClick={handleConfirmDelete}>Confirmar Exclusão</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

