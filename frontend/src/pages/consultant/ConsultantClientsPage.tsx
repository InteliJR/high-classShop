import { Fragment, useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getClients,
  getClientProcesses,
  removeClient,
  type Client,
} from "../../services/consultant.service";
import Button from "../../components/ui/button";
import { Alert } from "../../components/ui/alert";
import { Card } from "../../components/ui/card";
import { Dialog, DialogContent } from "../../components/ui/dialog";
import { PageHeader } from "../../components/patterns/PageHeader";
import { StatusBadge } from "../../components/patterns/StatusBadge";
import { EmptyState } from "../../components/patterns/EmptyState";
import InviteClientForm from "./InviteClientForm";
import BatchInviteClients from "./BatchInviteClients";
import EditClientForm from "./EditClientForm";
import { ChevronDown, ChevronUp, Loader2, Pencil, Trash2, Plus, Users } from "lucide-react";
import { applyDocumentMask } from "../../utils/mask";

type Process = {
  id: string;
  status: string;
  product_type: string | null;
  created_at: string;
  specialist?: { name: string; surname: string; speciality: string };
};

export default function ConsultantClientsPage() {
  const navigate = useNavigate();
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [expandedClient, setExpandedClient] = useState<string | null>(null);
  const [clientProcesses, setClientProcesses] = useState<Record<string, Process[]>>({});
  const [loadingProcesses, setLoadingProcesses] = useState<string | null>(null);

  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
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
          <div className="w-12 h-12 border-3 border-border-soft border-t-primary rounded-full animate-spin" />
          <p className="text-muted">Carregando clientes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="text-text-main w-full">
      <PageHeader
        title="Meus Clientes"
        actions={
          <>
            <Button type="button" variant="light" onClick={() => setIsBatchModalOpen(true)}>
              Convite em lote
            </Button>
            <Button type="button" onClick={() => setIsInviteModalOpen(true)}>
              <Plus size={16} />
              Convidar cliente
            </Button>
          </>
        }
      />

      {error && (
        <Alert variant="danger" className="mb-4">
          {error}
        </Alert>
      )}

      <Card>
        <h2 className="text-h2 font-semibold text-ink mb-1">Clientes</h2>
        <p className="text-sm text-muted mb-6">
          Expanda um cliente para ver seus processos. Para criar processo, abra o catálogo e clique em "Iniciar processo para cliente" no produto.
        </p>

        {clients.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Nenhum cliente ainda"
            description='Clique em "Convidar cliente" para começar.'
            action={
              <Button type="button" onClick={() => setIsInviteModalOpen(true)}>
                <Plus size={16} />
                Convidar cliente
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left text-xs uppercase tracking-wide text-muted font-semibold px-4 py-3">
                    Cliente
                  </th>
                  <th className="text-left text-xs uppercase tracking-wide text-muted font-semibold px-4 py-3">
                    E-mail
                  </th>
                  <th className="text-left text-xs uppercase tracking-wide text-muted font-semibold px-4 py-3">
                    Cadastro
                  </th>
                  <th className="w-24 px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => {
                  const isExpanded = expandedClient === client.id;
                  const processes = clientProcesses[client.id] ?? [];
                  const isLoadingProc = loadingProcesses === client.id;

                  return (
                    <Fragment key={client.id}>
                      <tr className="border-b border-border-soft hover:bg-border-soft/50">
                        <td className="px-4 py-3">
                          <button
                            onClick={() => toggleExpand(client.id)}
                            className="inline-flex items-center gap-2 font-medium text-ink"
                          >
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            {client.name} {client.surname}
                          </button>
                          <p className="text-xs text-subtle mt-0.5 pl-6">{client.cpf ? applyDocumentMask(client.cpf) : "-"}</p>
                        </td>
                        <td className="px-4 py-3 text-muted truncate">{client.email}</td>
                        <td className="px-4 py-3 text-muted">
                          {client.created_at ? new Date(client.created_at).toLocaleDateString("pt-BR") : "-"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 justify-end">
                            <button
                              onClick={() => setClientToEdit(client)}
                              className="p-1.5 rounded hover:bg-border-soft text-ink-soft"
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              onClick={() => setClientToDelete(client)}
                              className="p-1.5 rounded hover:bg-status-bad-wash text-status-bad"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={4} className="bg-border-soft/40 px-6 py-4">
                            {isLoadingProc ? (
                              <div className="flex items-center gap-2 text-subtle text-sm">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Carregando processos...
                              </div>
                            ) : processes.length === 0 ? (
                              <p className="text-sm text-muted">Nenhum processo ainda.</p>
                            ) : (
                              <div className="space-y-2">
                                <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">
                                  Processos ({processes.length})
                                </p>
                                {processes.map((proc) => (
                                  <div
                                    key={proc.id}
                                    onClick={() => navigate(`/consultant/processes/${proc.id}`)}
                                    className="flex items-center justify-between bg-surface rounded-lg px-4 py-3 border border-border-soft hover:border-border cursor-pointer transition-colors"
                                  >
                                    <div className="flex items-center gap-3">
                                      <StatusBadge status={proc.status} />
                                      <span className="text-sm text-muted">
                                        {proc.product_type ?? "Consultoria"} •{" "}
                                        {proc.specialist ? `${proc.specialist.name} ${proc.specialist.surname}` : "—"}
                                      </span>
                                    </div>
                                    <span className="text-xs text-subtle">
                                      {new Date(proc.created_at).toLocaleDateString("pt-BR")}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Modais */}
      <Dialog open={isInviteModalOpen} onOpenChange={setIsInviteModalOpen}>
        <DialogContent open={isInviteModalOpen} title="Convidar cliente" hideTitle>
          <InviteClientForm onSuccess={() => { setIsInviteModalOpen(false); fetchClients(); }} />
        </DialogContent>
      </Dialog>

      <Dialog open={isBatchModalOpen} onOpenChange={setIsBatchModalOpen}>
        <DialogContent open={isBatchModalOpen} title="Convite de clientes em lote" hideTitle>
          <BatchInviteClients onClose={() => setIsBatchModalOpen(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={!!clientToEdit} onOpenChange={(open) => !open && setClientToEdit(null)}>
        <DialogContent open={!!clientToEdit} title="Editar cliente" hideTitle>
          {clientToEdit && (
            <EditClientForm client={clientToEdit} onSuccess={() => { setClientToEdit(null); fetchClients(); }} />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!clientToDelete} onOpenChange={(open) => !open && setClientToDelete(null)}>
        <DialogContent open={!!clientToDelete} title="Confirmar remoção">
          <div>
            <p className="text-muted mb-6">
              Remover <strong className="text-ink">{clientToDelete?.name} {clientToDelete?.surname}</strong>? O cliente não será apagado, apenas desvinculado.
            </p>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="light" onClick={() => setClientToDelete(null)}>Cancelar</Button>
              <Button type="button" variant="danger" onClick={handleDelete}>Confirmar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
