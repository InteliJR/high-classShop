// Página de gestão de especialistas, com listagem, criação e exclusão.

import React, { useEffect, useState } from "react";
import {
  getSpecialists,
  deleteSpecialist,
  type Specialist,
} from "../../services/specialists.service";
import Button from "../../components/ui/button";
import EditIcon from "../../assets/icons/edit.svg";
import TrashIcon from "../../assets/icons/trash.svg";
import Modal from "../../components/ui/Modal";
import NewSpecialistForm from "./NewSpecialistForm";

export default function SpecialistsPage() {
  // Guarda os dados da API para serem renderizados na tabela.
  const [specialists, setSpecialists] = useState<Specialist[]>([]);
  // Controla a exibição de mensagens de 'loading' enquanto os dados são buscados.
  const [isLoading, setIsLoading] = useState(true);
  // Armazena mensagens de erro para exibir ao utilizador se a API falhar.
  const [error, setError] = useState<string | null>(null);

  // Controla a visibilidade do modal de criação de um novo especialista.
  const [isNewSpecialistModalOpen, setIsNewSpecialistModalOpen] = useState(false);
  // Guarda o especialista que está sendo editado, ou null se estiver criando um novo.
  const [specialistToEdit, setSpecialistToEdit] = useState<Specialist | null>(null);
  // Guarda o objeto do especialista que está prestes a ser apagado, controlando também o modal de confirmação.
  const [specialistToDelete, setSpecialistToDelete] = useState<Specialist | null>(null);

  // Busca os dados mais recentes da API e atualiza o estado da página.
  async function fetchData() {
    try {
      setIsLoading(true);
      const data = await getSpecialists();
      setSpecialists(data);
      setError(null);
    } catch (err) {
      setError("Não foi possível carregar os especialistas.");
    } finally {
      setIsLoading(false);
    }
  }

  // Função chamada quando o formulário de novo/edição de especialista é submetido com sucesso.
  const handleFormSuccess = () => {
    setIsNewSpecialistModalOpen(false);
    setSpecialistToEdit(null);
    fetchData();
  };

  // Função chamada pelo modal de confirmação para apagar um especialista.
  const handleConfirmDelete = async () => {
    if (!specialistToDelete) return;
    try {
      await deleteSpecialist(specialistToDelete.id);
      fetchData();
    } catch (err) {
      alert("Erro ao apagar o especialista. Tente novamente.");
    } finally {
      setSpecialistToDelete(null);
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
        <h1 className="h1-style">Gestão de Especialistas</h1>
        <Button type="button" onClick={() => setIsNewSpecialistModalOpen(true)}>
          + Novo Especialista
        </Button>
      </div>

      {/* --- TABELA DE ESPECIALISTAS --- */}
      <div className="p-6 rounded-lg shadow bg-brand-container bg-bg-container">
        <h2 className="h2-style">Especialistas</h2>
        <p className="text-base mb-8 mt-2">
          Lista completa de especialistas
        </p>

        {/* Cabeçalho da Lista */}
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-5 px-4 py-2 text-base font-normal text-left text-text-secondary">
          <div>Nome</div>
          <div>Email</div>
          <div>Especialidade</div>
          <div>Status</div>
          <div className="text-right">Ações</div>
        </div>

        {/* Corpo da Lista */}
        <div className="mt-4 flex flex-col gap-4 max-h-[70vh] overflow-y-auto p-2">
          {specialists.map((specialist) => (
            <div
              key={specialist.id}
              className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-5 items-center bg-brand-card p-6 rounded-lg shadow-sm bg-white"
            >
              <div className="flex items-center gap-3">
                <span className="font-normal">{specialist.name} {specialist.surname}</span>
              </div>
              <div>{specialist.email}</div>
              <div>
                <span className="bg-blue-100 text-blue-800 text-base px-2.5 py-0.5 rounded-full">
                  {specialist.speciality}
                </span>
              </div>
              <div>
                <span className="bg-status-active-bg text-status-active-text text-base px-2.5 py-0.5 rounded-full">
                  Ativo
                </span>
              </div>
              <div className="flex justify-end items-center gap-4 text-gray-400">
                <button onClick={() => setSpecialistToEdit(specialist)}>
                  <img
                    src={EditIcon}
                    alt="Editar"
                    className="h-6 w-6 cursor-pointer hover:text-gray-600"
                  />
                </button>

                <button onClick={() => setSpecialistToDelete(specialist)}>
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

      {/* Modal para criar novo especialista ou editar existente */}
      <Modal
        isOpen={isNewSpecialistModalOpen || !!specialistToEdit}
        onClose={() => {
          setIsNewSpecialistModalOpen(false);
          setSpecialistToEdit(null);
        }}
      >
        <NewSpecialistForm
          onSuccess={handleFormSuccess}
          specialistToEdit={specialistToEdit}
        />
      </Modal>

      {/* --- NOVO MODAL PARA CONFIRMAÇÃO DE EXCLUSÃO --- */}
      <Modal
        isOpen={!!specialistToDelete}
        onClose={() => setSpecialistToDelete(null)}
      >
        <div className="text-center">
          <h2 className="h2-style mb-4">Confirmar Exclusão</h2>
          <p className="text-text-secondary mb-8">
            Tem a certeza que deseja apagar o especialista{" "}
            <span className="font-bold">{specialistToDelete?.name}</span>? Esta
            ação não pode ser desfeita.
          </p>
          <div className="flex justify-center gap-4">
            <Button onClick={() => setSpecialistToDelete(null)}>Cancelar</Button>
            <Button onClick={handleConfirmDelete}>Confirmar Exclusão</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

