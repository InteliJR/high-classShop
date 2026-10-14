import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getClients, createConsultantProcess, type Client } from "../../services/consultant.service";
import { officeService } from "../../services/office";
import Button from "../../components/ui/button";
import { Loader2, Search } from "lucide-react";

/**
 * Consultor e gerente de escritório abrem processo em nome de um cliente pelo
 * mesmo fluxo; o que muda é de onde vem a lista de clientes, qual endpoint
 * cria o processo e para onde o usuário volta depois.
 */
const MODES = {
  CONSULTANT: {
    listClients: () => getClients(),
    createProcess: createConsultantProcess,
    redirectTo: "/consultant/processes",
    emptyMessage:
      'Você ainda não tem clientes. Convide um cliente primeiro em "Meus Clientes".',
  },
  OFFICE: {
    listClients: () => officeService.listClients(),
    createProcess: officeService.createProcess,
    redirectTo: "/office/processes",
    emptyMessage:
      "Nenhum cliente vinculado ao escritório ainda.",
  },
} as const;

interface Props {
  productType: "CAR" | "BOAT" | "AIRCRAFT";
  productId: string;
  specialistId: string;
  productLabel?: string;
  mode?: keyof typeof MODES;
  onClose: () => void;
  onBusyChange?(busy: boolean): void;
}

export default function StartProcessForClientModal(props: Props) {
  const mode = props.mode ?? "CONSULTANT";
  const scope = JSON.stringify([mode, props.specialistId, props.productType, props.productId]);
  return <StartProcessForClientModalInner key={scope} {...props} mode={mode} />;
}

function StartProcessForClientModalInner({
  productType,
  productId,
  specialistId,
  productLabel,
  mode = "CONSULTANT",
  onClose,
  onBusyChange,
}: Props) {
  const config = MODES[mode];
  const navigate = useNavigate();
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoadingClients, setIsLoadingClients] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const submittingRef = useRef(false);
  const mountedRef = useRef(false);
  const operationGeneration = useRef(0);
  const busyCallbackRef = useRef(onBusyChange);

  useLayoutEffect(() => {
    busyCallbackRef.current = onBusyChange;
  }, [onBusyChange]);

  useLayoutEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      operationGeneration.current += 1;
      busyCallbackRef.current?.(false);
    };
  }, []);

  const isCurrentOperation = (generation: number) =>
    mountedRef.current && operationGeneration.current === generation;

  const setBusy = (busy: boolean) => {
    setIsSubmitting(busy);
    busyCallbackRef.current?.(busy);
  };

  useEffect(() => {
    let active = true;
    setClients([]);
    setSelectedClient(null);
    setIsLoadingClients(true);
    config
      .listClients()
      .then((list) => { if (active) setClients(list as Client[]); })
      .catch(() => { if (active) setClients([]); })
      .finally(() => { if (active) setIsLoadingClients(false); });
    searchRef.current?.focus();
    // MODES é constante de módulo, então `config` só muda se `mode` mudar —
    // não recarrega a lista a cada render.
    return () => { active = false; };
  }, [config]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) =>
      `${c.name} ${c.surname} ${c.email ?? ""}`.toLowerCase().includes(q),
    );
  }, [clients, search]);

  const handleSubmit = async () => {
    if (submittingRef.current) return;
    if (!selectedClient) {
      setError("Selecione um cliente.");
      return;
    }
    setError(null);
    submittingRef.current = true;
    const generation = ++operationGeneration.current;
    const submittedClient = selectedClient;
    setBusy(true);
    try {
      await config.createProcess({
        client_id: submittedClient.id,
        specialist_id: specialistId,
        product_type: productType,
        product_id: productId,
      });
      if (!isCurrentOperation(generation)) return;
      // Criação delegada é sempre EMAIL; somente o próprio cliente pode abrir
      // e sincronizar um popup Calendly em uma sessão autenticada dele.
      navigate(config.redirectTo);
    } catch (err) {
      if (isCurrentOperation(generation)) {
        setError((err as Error).message || "Erro ao criar processo. Tente novamente.");
      }
    } finally {
      if (isCurrentOperation(generation)) {
        submittingRef.current = false;
        setBusy(false);
      }
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
            {config.emptyMessage}
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
                  disabled={isSubmitting}
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

      {error && <p role="alert" className="text-sm text-red-500">{error}</p>}

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" onClick={() => {
          if (submittingRef.current) return;
          operationGeneration.current += 1;
          onClose();
        }} disabled={isSubmitting}>
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
