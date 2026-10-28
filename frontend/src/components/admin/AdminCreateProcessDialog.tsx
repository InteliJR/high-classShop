import { useEffect, useState } from "react";
import { useAdminSpecialistJourney } from "../../contexts/AdminSpecialistJourneyContext";
import {
  getAdminClientOptions,
  getAdminSpecialistProducts,
  type AdminCatalogProduct,
  type AdminClientOption,
} from "../../services/admin-specialist-journey.service";
import { createProcess } from "../../services/processes.service";
import Button from "../ui/button";
import { Dialog, DialogContent } from "../ui/dialog";

export default function AdminCreateProcessDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const context = useAdminSpecialistJourney();
  const [clients, setClients] = useState<AdminClientOption[]>([]);
  const [products, setProducts] = useState<AdminCatalogProduct[]>([]);
  const [clientId, setClientId] = useState("");
  const [productId, setProductId] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !context) return;
    setError(null);
    void Promise.all([
      getAdminClientOptions(),
      getAdminSpecialistProducts(context.specialist.speciality, 1, 100),
    ])
      .then(([clientOptions, catalog]) => {
        setClients(clientOptions);
        setProducts(catalog.products.filter((product) => product.is_active));
      })
      .catch(() => setError("Não foi possível carregar clientes e produtos."));
  }, [open, context?.targetSpecialistId]);

  if (!context) return null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!clientId) return;
    setSubmitting(true);
    setError(null);
    try {
      await createProcess({
        client_id: clientId,
        specialist_id: context.targetSpecialistId,
        ...(productId
          ? {
              product_id: productId,
              product_type: context.specialist.speciality,
            }
          : {}),
        notes: notes || undefined,
      });
      setClientId("");
      setProductId("");
      setNotes("");
      onCreated();
      onClose();
    } catch (caught: any) {
      setError(
        caught?.friendlyMessage ||
          caught?.response?.data?.message ||
          "Não foi possível criar o processo e seu agendamento.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent open={open} title="Novo processo assistido" className="w-[min(620px,94vw)]">
        <form onSubmit={submit} className="space-y-4 p-1">
          <p className="text-sm text-ink-soft">
            O processo e o agendamento pendente por e-mail serão criados juntos
            para {context.specialist.name}.
          </p>
          {error && <p className="rounded-lg bg-status-bad-wash p-3 text-sm text-status-bad">{error}</p>}
          <label className="block text-sm font-medium text-ink">
            Cliente
            <select required value={clientId} onChange={(event) => setClientId(event.target.value)} className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2">
              <option value="">Selecione o cliente</option>
              {clients.map((client) => <option key={client.id} value={client.id}>{client.name} {client.surname} · {client.email}</option>)}
            </select>
          </label>
          <label className="block text-sm font-medium text-ink">
            Produto (opcional para consultoria)
            <select value={productId} onChange={(event) => setProductId(event.target.value)} className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2">
              <option value="">Consultoria sem produto definido</option>
              {products.map((product) => <option key={product.id} value={product.id}>{product.marca} {product.modelo}</option>)}
            </select>
          </label>
          <label className="block text-sm font-medium text-ink">
            Observações
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} className="mt-1 w-full rounded-lg border border-border px-3 py-2" rows={3} />
          </label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="light" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={submitting || !clientId}>{submitting ? "Criando…" : "Criar processo e agendamento"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
