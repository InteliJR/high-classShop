// Página principal do painel do Assessor (Consultant)

import { useEffect, useState } from "react";
import {
  getClients,
  removeClient,
  type Client,
} from "../../services/consultant.service";
import Button from "../../components/ui/button";
import EditIcon from "../../assets/icons/edit.svg";
import TrashIcon from "../../assets/icons/trash.svg";
import Modal from "../../components/ui/Modal";
import InviteClientForm from "./InviteClientForm";
import EditClientForm from "./EditClientForm";

export default function ConsultantDashboard() {
  // Guarda os dados dos clientes da API
  const [clients, setClients] = useState<Client[]>([]);
  // Controla a exibição de mensagens de 'loading' enquanto os dados são buscados
  const [isLoading, setIsLoading] = useState(true);
  // Armazena mensagens de erro para exibir ao utilizador se a API falhar
  const [error, setError] = useState<string | null>(null);

  // Controla a visibilidade do modal de convite de novo cliente
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  // Controla a visibilidade do modal de edição de cliente
  const [clientToEdit, setClientToEdit] = useState<Client | null>(null);
  // Guarda o objeto do cliente que está prestes a ser removido
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);

  // Busca os dados mais recentes da API e atualiza o estado da página
  async function fetchData() {
    try {
      setIsLoading(true);
      
      const data = await getClients();
      setClients(data);
      setError(null);
    } catch (err) {
      setError("Não foi possível carregar os clientes.");
      console.error("Erro ao carregar clientes:", err);
    } finally {
      setIsLoading(false);
    }
  }

  // Função chamada quando o formulário de convite é submetido com sucesso
  const handleInviteSuccess = () => {
    setIsInviteModalOpen(false);
    fetchData();
  };

  // Função chamada quando o formulário de edição é submetido com sucesso
  const handleEditSuccess = () => {
    setClientToEdit(null);
    fetchData();
  };

  // Função chamada pelo modal de confirmação para remover um cliente
  const handleConfirmDelete = async () => {
    if (!clientToDelete) return;
    try {
      // TODO: Call DELETE /api/consultant/clients/:id
      await removeClient(clientToDelete.id);
      fetchData();
    } catch (err) {
      alert("Erro ao remover o cliente. Tente novamente.");
      console.error("Erro ao remover cliente:", err);
    } finally {
      setClientToDelete(null);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Exibe uma mensagem de 'loading' enquanto os dados não chegam
  if (isLoading) {
    return <p>Carregando...</p>;
  }

  // Exibe uma mensagem de erro se a busca de dados falhar
  if (error) {
    return <p className="text-red-500">{error}</p>;
  }

  return (
    <div className="text-text-main w-full">
      {/* --- CABEÇALHO DA PÁGINA --- */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="h1-style">Meus Clientes</h1>
        <Button type="button" onClick={() => setIsInviteModalOpen(true)}>
          + Convidar Cliente
        </Button>
      </div>

      {/* --- TABELA DE CLIENTES --- */}
      <div className="p-6 rounded-lg shadow bg-brand-container bg-bg-container">
        <h2 className="h2-style">Clientes</h2>
        <p className="text-base mb-8 mt-2">
          Lista completa de clientes vinculados a você
        </p>

        {/* Cabeçalho da Lista */}
        <div className="grid grid-cols-[2fr_2fr_1fr_1fr_auto] gap-5 px-4 py-2 text-base font-normal text-left text-text-secondary">
          <div>Nome</div>
          <div>Email</div>
          <div>CPF</div>
          <div>Data de Cadastro</div>
          <div className="text-right">Ações</div>
        </div>

        {/* Corpo da Lista */}
        <div className="mt-4 flex flex-col gap-4 max-h-[70vh] overflow-y-auto p-2">
          {clients.length === 0 ? (
            <div className="text-center py-8 text-text-secondary">
              Nenhum cliente cadastrado ainda. Clique em "Convidar Cliente" para começar.
            </div>
          ) : (
            clients.map((client) => (
              <div
                key={client.id}
                className="grid grid-cols-[2fr_2fr_1fr_1fr_auto] gap-5 items-center bg-brand-card p-6 rounded-lg shadow-sm bg-white"
              >
                <div className="font-normal">
                  {client.name} {client.surname}
                </div>
                <div>{client.email}</div>
                <div>{client.cpf || "-"}</div>
                <div>
                  {client.created_at 
                    ? new Date(client.created_at).toLocaleDateString("pt-BR")
                    : "-"}
                </div>
                <div className="flex justify-end items-center gap-4 text-gray-400">
                  <button onClick={() => setClientToEdit(client)}>
                    <img
                      src={EditIcon}
                      alt="Editar"
                      className="h-6 w-6 cursor-pointer"
                    />
                  </button>

                  <button onClick={() => setClientToDelete(client)}>
                    <img
                      src={TrashIcon}
                      alt="Remover"
                      className="h-5 w-5 cursor-pointer"
                    />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* --- MODAIS --- */}

      {/* Modal para convidar novo cliente */}
      <Modal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
      >
        <InviteClientForm onSuccess={handleInviteSuccess} />
      </Modal>

      {/* Modal para editar cliente */}
      <Modal
        isOpen={!!clientToEdit}
        onClose={() => setClientToEdit(null)}
      >
        {clientToEdit && (
          <EditClientForm client={clientToEdit} onSuccess={handleEditSuccess} />
        )}
      </Modal>

      {/* Modal para confirmação de exclusão */}
      <Modal
        isOpen={!!clientToDelete}
        onClose={() => setClientToDelete(null)}
      >
        <div className="text-center">
          <h2 className="h2-style mb-4">Confirmar Remoção</h2>
          <p className="text-text-secondary mb-8">
            Tem a certeza que deseja remover o cliente{" "}
            <span className="font-bold">
              {clientToDelete?.name} {clientToDelete?.surname}
            </span>
            ? O cliente será desvinculado de você, mas não será apagado do sistema.
          </p>
          <div className="flex justify-center gap-4">
            <Button onClick={() => setClientToDelete(null)}>Cancelar</Button>
            <Button onClick={handleConfirmDelete}>Confirmar Remoção</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

