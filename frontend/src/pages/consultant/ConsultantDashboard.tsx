// Página principal do painel do Assessor (Consultant)

import { useEffect, useRef, useState } from "react";
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

function formatCPF(cpf: string | null): string {
  if (!cpf) return "-";
  const cleaned = cpf.replace(/\D/g, "");
  if (cleaned.length !== 11) return cpf;
  return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

export default function ConsultantDashboard() {
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasFetched = useRef(false);

  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [clientToEdit, setClientToEdit] = useState<Client | null>(null);
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);

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

  const handleInviteSuccess = () => {
    setIsInviteModalOpen(false);
    fetchData();
  };

  const handleEditSuccess = () => {
    setClientToEdit(null);
    fetchData();
  };

  const handleConfirmDelete = async () => {
    if (!clientToDelete) return;
    try {
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
    if (hasFetched.current) return; // Evita dupla chamada com StrictMode
    hasFetched.current = true;
    fetchData();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-3 border-gray-200 border-t-primary rounded-full animate-spin" />
          <p className="text-gray-600">Carregando dashboard...</p>
        </div>
      </div>
    );
  }

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
      <div className="p-6 rounded-lg shadow bg-white">
        <h2 className="h2-style">Clientes</h2>
        <p className="text-base mb-6 mt-2 text-gray-600">
          Lista completa de clientes vinculados a você
        </p>

        {clients.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            Nenhum cliente cadastrado ainda. Clique em "Convidar Cliente" para começar.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-sm text-gray-700">Nome</th>
                  <th className="text-left py-3 px-4 font-semibold text-sm text-gray-700">Email</th>
                  <th className="text-left py-3 px-4 font-semibold text-sm text-gray-700">CPF</th>
                  <th className="text-left py-3 px-4 font-semibold text-sm text-gray-700">Data de Cadastro</th>
                  <th className="text-right py-3 px-4 font-semibold text-sm text-gray-700">Ações</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => (
                  <tr key={client.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="py-4 px-4">
                      {client.name} {client.surname}
                    </td>
                    <td className="py-4 px-4 text-gray-600">{client.email}</td>
                    <td className="py-4 px-4 text-gray-600">{formatCPF(client.cpf)}</td>
                    <td className="py-4 px-4 text-gray-600">
                      {client.created_at 
                        ? new Date(client.created_at).toLocaleDateString("pt-BR")
                        : "-"}
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex justify-end items-center gap-3">
                        <button 
                          onClick={() => setClientToEdit(client)}
                          className="p-2 hover:bg-gray-200 rounded transition-colors"
                          title="Editar"
                        >
                          <img src={EditIcon} alt="Editar" className="h-5 w-5" />
                        </button>
                        <button 
                          onClick={() => setClientToDelete(client)}
                          className="p-2 hover:bg-red-100 rounded transition-colors"
                          title="Remover"
                        >
                          <img src={TrashIcon} alt="Remover" className="h-5 w-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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

