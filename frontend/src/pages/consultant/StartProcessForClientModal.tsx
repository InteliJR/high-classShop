import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getClients, createConsultantProcess, type Client } from "../../services/consultant.service";
import Button from "../../components/ui/button";
import { Loader2, Search } from "lucide-react";

interface Props {
  productType: "CAR" | "BOAT" | "AIRCRAFT";
  productId: number;
  specialistId: string;
  productLabel?: string;
  onClose: () => void;
}

export default function StartProcessForClientModal({
  productType,
  productId,
  specialistId,
  productLabel,
  onClose,
}: Props) {
  const navigate = useNavigate();
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoadingClients, setIsLoadingClients] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getClients()
      .then(setClients)
      .catch(() => setClients([]))
      .finally(() => setIsLoadingClients(false));
    searchRef.current?.focus();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) =>
      `${c.name} ${c.surname} ${c.email ?? ""}`.toLowerCase().includes(q),
    );
  }, [clients, search]);

  const handleSubmit = async () => {
    if (!selectedClient) {
      setError("Selecione um cliente.");
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await createConsultantProcess({
        client_id: selectedClient.id,
        specialist_id: specialistId,
        product_type: productType,
        product_id: productId,
      });
      const newProcessId = (result as { id?: string } | null)?.id;
      if (newProcessId) {
        navigate(`/processes/${newProcessId}/negotiation`);
      } else {
        navigate("/consultant/processes");
      }
    } catch (err) {
      setError((err as Error).message || "Erro ao criar processo. Tente novamente.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="h2-style">Iniciar processo para cliente</h2>
        {productLabel && (
          <p className="text-sm text-gray-500 mt-1">
            Produto: <strong>{productLabel}</strong>
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Selecione o cliente
        </label>
        <div className="relative mb-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            ref={searchRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou e-mail..."
            className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md text-sm"
          />
        </div>

        {isLoadingClients ? (
          <div className="flex items-center justify-center py-8 gap-2 text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Carregando clientes...</span>
          </div>
        ) : clients.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">
            Você ainda não tem clientes. Convide um cliente primeiro em "Meus Clientes".
          </p>
        ) : (
          <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-md divide-y divide-gray-100">
            {filtered.length === 0 ? (
              <p className="text-sm text-gray-400 px-3 py-2">Nenhum cliente encontrado.</p>
            ) : (
              filtered.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedClient(c)}
                  className={`w-full text-left px-3 py-2 hover:bg-gray-50 transition-colors ${
                    selectedClient?.id === c.id ? "bg-blue-50" : ""
                  }`}
                >
                  <div className="text-sm font-medium text-gray-900">
                    {c.name} {c.surname}
                  </div>
                  <div className="text-xs text-gray-400">{c.email}</div>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" onClick={onClose} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting || !selectedClient || isLoadingClients}
        >
          {isSubmitting ? "Criando..." : "Criar processo"}
        </Button>
      </div>
    </div>
  );
}
