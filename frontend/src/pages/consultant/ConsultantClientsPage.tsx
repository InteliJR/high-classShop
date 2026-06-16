import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getClients,
  getClientProcesses,
  removeClient,
  type Client,
} from "../../services/consultant.service";
import Button from "../../components/ui/button";
import Modal from "../../components/ui/Modal";
import InviteClientForm from "./InviteClientForm";
import EditClientForm from "./EditClientForm";
import { ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import TrashIcon from "../../assets/icons/trash.svg";
import EditIcon from "../../assets/icons/edit.svg";

type Process = {
  id: string;
  status: string;
  product_type: string | null;
  created_at: string;
  specialist?: { name: string; surname: string; speciality: string };
};

const STATUS_LABELS: Record<string, string> = {
  SCHEDULING: "Agendamento",
  NEGOTIATION: "Negociação",
  PROCESSING_CONTRACT: "Contrato",
  DOCUMENTATION: "Documentação",
  COMPLETED: "Concluído",
  REJECTED: "Rejeitado",
};

const STATUS_COLORS: Record<string, string> = {
  SCHEDULING: "bg-blue-100 text-blue-700",
  NEGOTIATION: "bg-yellow-100 text-yellow-700",
  PROCESSING_CONTRACT: "bg-orange-100 text-orange-700",
  DOCUMENTATION: "bg-purple-100 text-purple-700",
  COMPLETED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
};

function formatCPF(cpf: string | null): string {
  if (!cpf) return "-";
  const c = cpf.replace(/\D/g, "");
  return c.length === 11 ? c.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4") : cpf;
}

export default function ConsultantClientsPage() {
  const navigate = useNavigate();
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [expandedClient, setExpandedClient] = useState<string | null>(null);
  const [clientProcesses, setClientProcesses] = useState<Record<string, Process[]>>({});
  const [loadingProcesses, setLoadingProcesses] = useState<string | null>(null);

  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [clientToEdit, setClientToEdit] = useState<Client | null>(null);
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);

  const fetchClients = useCallback(async () => {
    try {
      setIsLoading(true);
      setClients(await getClients());
      setError(null);
    } catch {
      setError("Não foi possível carregar os clientes.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchClients(); }, [fetchClients]);

  const toggleExpand = useCallback(async (clientId: string) => {
    if (expandedClient === clientId) {
      setExpandedClient(null);
      return;
    }
    setExpandedClient(clientId);
    if (!clientProcesses[clientId]) {
      setLoadingProcesses(clientId);
      try {
        const processes = await getClientProcesses(clientId) as Process[];
        setClientProcesses((prev) => ({ ...prev, [clientId]: processes }));
      } catch {
        setClientProcesses((prev) => ({ ...prev, [clientId]: [] }));
      } finally {
        setLoadingProcesses(null);
      }
    }
  }, [expandedClient, clientProcesses]);

  const handleDelete = async () => {
    if (!clientToDelete) return;
    try {
      await removeClient(clientToDelete.id);
      fetchClients();
    } catch {
      alert("Erro ao remover o cliente.");
    } finally {
      setClientToDelete(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-3 border-gray-200 border-t-primary rounded-full animate-spin" />
          <p className="text-gray-600">Carregando clientes...</p>
        </div>
      </div>
    );
  }

  if (error) return <p className="text-red-500">{error}</p>;

  return (
    <div className="text-text-main w-full">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="h1-style">Meus Clientes</h1>
        <Button type="button" onClick={() => setIsInviteModalOpen(true)}>
          + Convidar Cliente
        </Button>
      </div>

      <div className="p-6 rounded-lg shadow bg-white">
        <h2 className="h2-style">Clientes</h2>
        <p className="text-sm text-gray-500 mt-1 mb-6">
          Expanda um cliente para ver seus processos. Para criar processo, abra o catálogo e clique em "Iniciar processo para cliente" no produto.
        </p>

        {clients.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            Nenhum cliente ainda. Clique em "+ Convidar Cliente" para começar.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {clients.map((client) => {
              const isExpanded = expandedClient === client.id;
              const processes = clientProcesses[client.id] ?? [];
              const isLoadingProc = loadingProcesses === client.id;

              return (
                <div key={client.id} className="rounded-lg border border-gray-200 overflow-hidden">
                  {/* Client row */}
                  <div className="grid grid-cols-[auto_2fr_1.5fr_1fr_auto] gap-4 items-center px-4 py-4 bg-white">
                    <button
                      onClick={() => toggleExpand(client.id)}
                      className="p-1 hover:bg-gray-100 rounded"
                    >
                      {isExpanded
                        ? <ChevronUp className="w-5 h-5 text-gray-500" />
                        : <ChevronDown className="w-5 h-5 text-gray-500" />
                      }
                    </button>

                    <div>
                      <p className="font-medium text-gray-900">{client.name} {client.surname}</p>
                      <p className="text-xs text-gray-400">{formatCPF(client.cpf)}</p>
                    </div>

                    <p className="text-sm text-gray-600 truncate">{client.email}</p>

                    <p className="text-xs text-gray-400">
                      {client.created_at ? new Date(client.created_at).toLocaleDateString("pt-BR") : "-"}
                    </p>

                    <div className="flex items-center gap-2">
                      <button onClick={() => setClientToEdit(client)} className="p-1.5 hover:bg-gray-100 rounded">
                        <img src={EditIcon} alt="Editar" className="h-4 w-4" />
                      </button>
                      <button onClick={() => setClientToDelete(client)} className="p-1.5 hover:bg-red-50 rounded">
                        <img src={TrashIcon} alt="Remover" className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Expanded: processes */}
                  {isExpanded && (
                    <div className="border-t border-gray-100 bg-gray-50 px-6 py-4">
                      {isLoadingProc ? (
                        <div className="flex items-center gap-2 text-gray-400 text-sm">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Carregando processos...
                        </div>
                      ) : processes.length === 0 ? (
                        <p className="text-sm text-gray-500">Nenhum processo ainda.</p>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                            Processos ({processes.length})
                          </p>
                          {processes.map((proc) => (
                            <div
                              key={proc.id}
                              onClick={() => navigate(`/consultant/processes/${proc.id}`)}
                              className="flex items-center justify-between bg-white rounded-lg px-4 py-3 border border-gray-100 hover:border-gray-300 cursor-pointer transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[proc.status] ?? "bg-gray-100 text-gray-600"}`}>
                                  {STATUS_LABELS[proc.status] ?? proc.status}
                                </span>
                                <span className="text-sm text-gray-600">
                                  {proc.product_type ?? "Consultoria"} •{" "}
                                  {proc.specialist ? `${proc.specialist.name} ${proc.specialist.surname}` : "—"}
                                </span>
                              </div>
                              <span className="text-xs text-gray-400">
                                {new Date(proc.created_at).toLocaleDateString("pt-BR")}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modais */}
      <Modal isOpen={isInviteModalOpen} onClose={() => setIsInviteModalOpen(false)}>
        <InviteClientForm onSuccess={() => { setIsInviteModalOpen(false); fetchClients(); }} />
      </Modal>

      <Modal isOpen={!!clientToEdit} onClose={() => setClientToEdit(null)}>
        {clientToEdit && (
          <EditClientForm client={clientToEdit} onSuccess={() => { setClientToEdit(null); fetchClients(); }} />
        )}
      </Modal>

      <Modal isOpen={!!clientToDelete} onClose={() => setClientToDelete(null)}>
        <div className="text-center">
          <h2 className="h2-style mb-4">Confirmar Remoção</h2>
          <p className="text-text-secondary mb-8">
            Remover <strong>{clientToDelete?.name} {clientToDelete?.surname}</strong>? O cliente não será apagado, apenas desvinculado.
          </p>
          <div className="flex justify-center gap-4">
            <Button onClick={() => setClientToDelete(null)}>Cancelar</Button>
            <Button onClick={handleDelete}>Confirmar</Button>
          </div>
        </div>
      </Modal>

    </div>
  );
}
